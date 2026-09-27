/**
 * Meta Ad Account Sharing Instructions Content
 * 
 * Step-by-step instructions for manually sharing ad accounts in Meta Business Manager
 */

export const META_AD_ACCOUNT_INSTRUCTIONS = {
  en: {
    title: 'Grant access to your Ad Accounts (Manual)',
    description: 'Follow this guide to grant access',
    step1: {
      title: 'Select Assets',
      description: 'Select the ad accounts you want to grant access to',
      businessIdLabel: 'Business Manager ID',
    },
    step2: {
      title: 'Share Asset',
      description: 'Navigate to Meta Ads in Meta Business Suite (Settings → Ad accounts), then:',
      securityNote: 'If Meta blocks the assignment and asks for two-factor authentication, enable it for your Facebook account in security settings. Then repeat the partner assignment and check access again.',
      substeps: [
        'Select the ad account from the sidebar and click the "Assign Partner" button',
        'In the "Partner business ID" textbox, enter:',
        'Check the "Manage ad accounts" checkbox',
        'Click the "Assign" button',
        'Wait for the indicator to turn from waiting to granted',
      ],
    },
    openBusinessManager: 'Open Business Manager',
    checkAccess: 'Check access',
    verifiedButton: 'Access verified',
    starting: 'Preparing ad-account sharing verification...',
    verifying: 'Checking access...',
    waiting: 'Waiting for access to be granted... {verifiedCount}/{selectedCount}',
    verified: 'Access verified for {count} ad account(s).',
    pending: 'Still pending verification',
  },
  es: {
    title: 'Conceder acceso a tus cuentas de anuncios (Manual)',
    description: 'Sigue esta guía para conceder acceso',
    step1: {
      title: 'Seleccionar activos',
      description: 'Selecciona las cuentas de anuncios a las que quieres conceder acceso',
      businessIdLabel: 'ID del Business Manager',
    },
    step2: {
      title: 'Compartir activo',
      description: 'Navega a Meta Ads en Meta Business Suite (Configuración → Cuentas de anuncios), luego:',
      securityNote: 'Si Meta bloquea la asignación y solicita autenticación en dos pasos, actívala para tu cuenta de Facebook en la configuración de seguridad. Después, vuelve a asignar el socio y comprueba el acceso.',
      substeps: [
        'Selecciona la cuenta de anuncios desde la barra lateral y haz clic en el botón "Asignar socio"',
        'En el cuadro de texto "ID del Business Manager del socio", ingresa:',
        'Marca la casilla "Administrar cuentas de anuncios"',
        'Haz clic en el botón "Asignar"',
        'Espera a que el indicador cambie de esperando a concedido',
      ],
    },
    openBusinessManager: 'Abrir Business Manager',
    checkAccess: 'Verificar acceso',
    verifiedButton: 'Acceso verificado',
    starting: 'Preparando la verificación de acceso...',
    verifying: 'Verificando acceso...',
    waiting: 'Esperando que se conceda el acceso... {verifiedCount}/{selectedCount}',
    verified: 'Acceso verificado para {count} cuenta(s) de anuncios.',
    pending: 'Aún pendiente de verificación',
  },
  nl: {
    title: 'Geef toegang tot je advertentieaccounts (Handmatig)',
    description: 'Volg deze gids om toegang te verlenen',
    step1: {
      title: 'Selecteer activa',
      description: 'Selecteer de advertentieaccounts waaraan je toegang wilt verlenen',
      businessIdLabel: 'Business Manager ID',
    },
    step2: {
      title: 'Deel activum',
      description: 'Navigeer naar Meta Ads in Meta Business Suite (Instellingen → Advertentieaccounts), dan:',
      securityNote: 'Als Meta de toewijzing blokkeert en tweestapsverificatie vraagt, schakel dit dan in voor je Facebook-account bij de beveiligingsinstellingen. Wijs de partner daarna opnieuw toe en controleer de toegang.',
      substeps: [
        'Selecteer het advertentieaccount vanuit de zijbalk en klik op de knop "Partner toewijzen"',
        'Voer in het tekstvak "Partner Business Manager ID" in:',
        'Vink het selectievakje "Advertentieaccounts beheren" aan',
        'Klik op de knop "Toewijzen"',
        'Wacht totdat de indicator verandert van wachten naar toegekend',
      ],
    },
    openBusinessManager: 'Business Manager openen',
    checkAccess: 'Toegang controleren',
    verifiedButton: 'Toegang geverifieerd',
    starting: 'Verificatie van advertentieaccounttoegang voorbereiden...',
    verifying: 'Toegang controleren...',
    waiting: 'Wachten totdat toegang is verleend... {verifiedCount}/{selectedCount}',
    verified: 'Toegang geverifieerd voor {count} advertentieaccount(s).',
    pending: 'Nog in afwachting van verificatie',
  },
} as const;

export type MetaAdAccountInstructionsLanguage = keyof typeof META_AD_ACCOUNT_INSTRUCTIONS;
