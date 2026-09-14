import { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { submitIntakeSchema } from './schemas.js';
import { sendError } from '../../lib/response.js';

type IntakeField = {
  id?: unknown;
  required?: unknown;
  type?: unknown;
  options?: unknown;
};

function validateIntakeResponses(
  fields: unknown,
  responses: Record<string, string>
): Array<{ field: string; message: string }> {
  if (!Array.isArray(fields)) {
    return [{ field: 'intakeFields', message: 'This request has an invalid intake form.' }];
  }

  const configuredFields = fields as IntakeField[];
  const fieldIds = new Set(
    configuredFields
      .map((field) => (typeof field.id === 'string' ? field.id : null))
      .filter((id): id is string => Boolean(id))
  );
  const errors: Array<{ field: string; message: string }> = [];

  if (fieldIds.size !== configuredFields.length) {
    return [{ field: 'intakeFields', message: 'This request has an invalid intake form.' }];
  }

  for (const fieldId of Object.keys(responses)) {
    if (!fieldIds.has(fieldId)) {
      errors.push({ field: fieldId, message: 'This field is not part of the request.' });
    }
  }

  for (const field of configuredFields) {
    const fieldId = field.id as string;
    const value = responses[fieldId] ?? '';

    if (field.required === true && !value.trim()) {
      errors.push({ field: fieldId, message: 'This field is required.' });
    }

    if (
      field.type === 'dropdown' &&
      value &&
      (!Array.isArray(field.options) || !field.options.includes(value))
    ) {
      errors.push({ field: fieldId, message: 'Choose one of the provided options.' });
    }
  }

  return errors;
}

export async function registerIntakeRoutes(fastify: FastifyInstance) {
  // Submit intake form responses
  fastify.post('/client/:token/intake', async (request, reply) => {
    const { token } = request.params as { token: string };

    // Narrow read: intake only needs id, fields, and expiry — not the full
    // client-facing payload the by-token service assembles.
    const accessRequest = await prisma.accessRequest.findUnique({
      where: { uniqueToken: token },
      select: { id: true, intakeFields: true, expiresAt: true },
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

    const validated = submitIntakeSchema.safeParse(request.body);
    if (!validated.success) {
      return sendError(reply, 'VALIDATION_ERROR', 'Invalid intake responses', 400, validated.error.errors,);
    }

    const errors = validateIntakeResponses(
      accessRequest.intakeFields,
      validated.data.intakeResponses
    );
    if (errors.length > 0) {
      return sendError(reply, 'VALIDATION_ERROR', 'Invalid intake responses', 400, errors);
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
      fastify.log.error({ error, token }, 'Failed to save intake responses');
      return sendError(reply, 'INTAKE_SAVE_FAILED', 'Could not save your responses. Please try again.', 500);
    }
  });
}
