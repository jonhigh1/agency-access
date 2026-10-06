/**
 * Meta Grant Access Content
 * 
 * Content strings for Meta automatic and manual access granting flows
 */

export const META_GRANT_METHOD_LABELS = {
  automatic: 'Automatic',
  manual: 'Manual',
} as const;

export const META_GRANT_ACCESS = {
  en: {
    automatic: {
      title: 'Automatic',
      subtitle: 'AuthHub assigns these in Meta and confirms the result for you',
      facebookPages: {
        title: 'Facebook Pages',
        accessLevel: 'Admin', // or from access request
        grantButton: 'Grant access',
        granting: 'Granting...',
        success: 'Access granted successfully',
        readBackSuccessTitle: 'Partner access confirmed',
        readBackSuccessDetail:
          'Meta read-back verified the agency Partner assignment on each selected Page.',
        readBackFailureTitle: 'Automatic assignment could not be confirmed',
        tryAgainButton: 'Try Grant Access again',
        error: 'Failed to grant access',
        manualFallback:
          'Automatic assignment did not complete. Add the agency as a Partner on these Pages in Meta Business Settings, then try Grant Access again or ask the agency to verify.',
      },
    },
    manual: {
      title: 'Manual',
      subtitle:
        'Add the agency as a Partner on these assets in Meta Business Settings, then use Check access here.',
      systemUserDisclaimer:
        'System-user assignment is separate from Partner share. It does not prove the agency owner has human Ads Manager access.',
    },
  },
  es: {
    automatic: {
      title: 'Automático',
      subtitle: 'AuthHub asigna estos activos en Meta y confirma el resultado por ti',
      facebookPages: {
        title: 'Páginas de Facebook',
        accessLevel: 'Administrador',
        grantButton: 'Conceder acceso',
        granting: 'Concediendo...',
        success: 'Acceso concedido exitosamente',
        error: 'Error al conceder acceso',
      },
    },
    manual: {
      title: 'Manual',
      subtitle:
        'Añade la agencia como socio en estos activos en Meta Business Settings y luego usa Verificar acceso aquí.',
      systemUserDisclaimer:
        'La asignación al system user es independiente del acceso Partner. No demuestra que el propietario de la agencia tenga acceso humano a Ads Manager.',
    },
  },
  nl: {
    automatic: {
      title: 'Automatisch',
      subtitle: 'AuthHub wijst deze toe in Meta en bevestigt het resultaat voor je',
      facebookPages: {
        title: 'Facebook Pagina\'s',
        accessLevel: 'Beheerder',
        grantButton: 'Toegang verlenen',
        granting: 'Toegang verlenen...',
        success: 'Toegang succesvol verleend',
        error: 'Toegang verlenen mislukt',
      },
    },
    manual: {
      title: 'Handmatig',
      subtitle:
        'Voeg het agency toe als Partner op deze activa in Meta Business Settings en gebruik daarna Check access hier.',
      systemUserDisclaimer:
        'Toewijzing aan een system user is los van Partner-toegang. Het bewijst niet dat de agency-eigenaar menselijke Ads Manager-toegang heeft.',
    },
  },
} as const;

export type MetaGrantAccessLanguage = keyof typeof META_GRANT_ACCESS;

