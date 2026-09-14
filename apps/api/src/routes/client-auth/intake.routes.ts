import { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { submitIntakeSchema } from './schemas.js';
import { sendError } from '../../lib/response.js';

type IntakeField = {
  id?: unknown;
  label?: unknown;
  required?: unknown;
  type?: unknown;
  options?: unknown;
};

type IntakeFieldError = { field: string; message: string };

type IntakeValidationResult =
  | { ok: true; errors: IntakeFieldError[] }
  | { ok: false; configError: 'INVALID_INTAKE_FORM' };

function validateIntakeResponses(
  fields: unknown,
  responses: Record<string, string>
): IntakeValidationResult {
  if (!Array.isArray(fields)) {
    return {
      ok: true,
      errors: [{ field: 'intakeFields', message: 'This request has an invalid intake form.' }],
    };
  }

  const configuredFields = fields as IntakeField[];
  const hasId = (field: IntakeField): boolean =>
    typeof field.id === 'string' && field.id.length > 0;
  // Legacy forms store fields without ids; answers are keyed by label.
  const labelKeyed = configuredFields.every((field) => !hasId(field));

  const keys = configuredFields.map((field) => {
    if (labelKeyed) {
      return typeof field.label === 'string' ? field.label : '';
    }
    return hasId(field) ? (field.id as string) : '';
  });

  // Missing, mixed, or duplicated answer keys describe a broken stored form —
  // an agency-side configuration problem, not a client input problem.
  if (keys.some((key) => !key || keys.indexOf(key) !== keys.lastIndexOf(key))) {
    return { ok: false, configError: 'INVALID_INTAKE_FORM' };
  }

  const validKeys = new Set(keys);
  const errors: IntakeFieldError[] = [];

  for (const key of Object.keys(responses)) {
    if (!validKeys.has(key)) {
      errors.push({ field: key, message: 'This field is not part of the request.' });
    }
  }

  configuredFields.forEach((field, index) => {
    const key = keys[index];
    const value = responses[key] ?? '';

    if (field.required === true && !value.trim()) {
      errors.push({ field: key, message: 'This field is required.' });
    }

    if (
      field.type === 'dropdown' &&
      value &&
      (!Array.isArray(field.options) || !field.options.includes(value))
    ) {
      errors.push({ field: key, message: 'Choose one of the provided options.' });
    }
  });

  return { ok: true, errors };
}

export async function registerIntakeRoutes(fastify: FastifyInstance) {
  // Submit intake form responses
  fastify.post('/client/:token/intake', async (request, reply) => {
    const { token } = request.params as { token: string };

    // Narrow read: intake only needs id, status, fields, and expiry — not the
    // full client-facing payload the by-token service assembles.
    const accessRequest = await prisma.accessRequest.findUnique({
      where: { uniqueToken: token },
      select: { id: true, status: true, intakeFields: true, expiresAt: true },
    });

    if (!accessRequest) {
      return reply.code(404).send({
        data: null,
        error: {
          code: 'REQUEST_NOT_FOUND',
          message: 'Access request not found',
        },
      });
    }

    if (accessRequest.expiresAt < new Date()) {
      return reply.code(404).send({
        data: null,
        error: {
          code: 'REQUEST_EXPIRED',
          message: 'Access request has expired',
        },
      });
    }

    // Completed or revoked requests are closed; never accept writes for them.
    if (accessRequest.status === 'completed' || accessRequest.status === 'revoked') {
      return reply.code(404).send({
        data: null,
        error: {
          code: 'REQUEST_NOT_FOUND',
          message: 'Access request not found',
        },
      });
    }

    const validated = submitIntakeSchema.safeParse(request.body);
    if (!validated.success) {
      // Keep the details shape identical to the field-validation branch below.
      const details = validated.error.errors.map((issue) => ({
        field: issue.path.join('.') || 'intakeResponses',
        message: issue.message,
      }));
      return sendError(reply, 'VALIDATION_ERROR', 'Invalid intake responses', 400, details);
    }

    const validation = validateIntakeResponses(
      accessRequest.intakeFields,
      validated.data.intakeResponses
    );
    if (!validation.ok) {
      return sendError(
        reply,
        validation.configError,
        'This request has an invalid intake form.',
        422
      );
    }
    if (validation.errors.length > 0) {
      return sendError(reply, 'VALIDATION_ERROR', 'Invalid intake responses', 400, validation.errors);
    }

    try {
      const saved = await prisma.accessRequest.update({
        where: { id: accessRequest.id },
        data: {
          intakeResponses: validated.data.intakeResponses as Prisma.InputJsonValue,
        },
        select: { intakeResponses: true },
      });

      return reply.send({
        data: {
          success: true,
          message: 'Intake responses saved',
          intakeResponses: saved.intakeResponses,
        },
        error: null,
      });
    } catch (error) {
      fastify.log.error({ error, requestId: request.id }, 'Failed to save intake responses');
      return sendError(reply, 'INTAKE_SAVE_FAILED', 'Could not save your responses. Please try again.', 500);
    }
  });
}
