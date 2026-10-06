/**
 * Meta Ad Account Sharing Instructions Content
 *
 * Step-by-step instructions for manually sharing ad accounts in Meta Business Manager.
 * U9 additions carry the stateful-checklist copy: plain-language framing,
 * the one-tap copy card, and the revocation reassurance line.
 */

export const META_AD_ACCOUNT_INSTRUCTIONS = {
  en: {
    title: 'Grant access to your Ad Accounts (Manual)',
    description: 'Follow this guide to grant access',
    intro: 'This gives {agency} access to the {count} ad account(s) you selected, so they can run ads for you.',
    scopeNote: 'In Meta, "Manage ad accounts" means {agency} can create and run ads in your accounts — nothing else.',
    checklistHint: 'Check off each step as you finish it',
    revocationNote: 'You can remove this access anytime in Meta Business Settings → Partners.',
    copyCard: {
      label: 'Agency Business ID',
      helper: 'Tap Copy once, then paste it into Meta Business Settings.',
      copyButton: 'Copy',
      copied: 'Copied',
    },
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
    starting: 'Setting up Check access…',
    verifying: 'Checking access...',
    waiting: 'Needs you in Meta — {verifiedCount} of {selectedCount} verified',
    verified: 'Access verified for {count} ad account(s).',
    pending: 'Still pending verification',
  },
  es: {
    title: 'Conceder acceso a tus cuentas de anuncios (Manual)',
    description: 'Sigue esta guía para conceder acceso',
    intro: 'Esto da a {agency} acceso a las {count} cuenta(s) de anuncios que seleccionaste, para que publiquen anuncios por ti.',
    scopeNote: 'En Meta, "Administrar cuentas de anuncios" significa que {agency} puede crear y publicar anuncios en tus cuentas, nada más.',
    checklistHint: 'Marca cada paso a medida que lo completes',
    revocationNote: 'Puedes quitar este acceso en cualquier momento en Meta Business Settings → Partners.',
    copyCard: {
      label: 'ID del Business de la agencia',
      helper: 'Toca Copiar una vez y pégalo en Meta Business Settings.',
      copyButton: 'Copiar',
      copied: 'Copiado',
    },
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
    intro: 'Dit geeft {agency} toegang tot de {count} advertentieaccount(s) die je hebt geselecteerd, zodat zij advertenties voor je kunnen plaatsen.',
    scopeNote: 'In Meta betekent "Advertentieaccounts beheren" dat {agency} advertenties kan maken en plaatsen in je accounts — niets anders.',
    checklistHint: 'Vink elke stap af zodra je klaar bent',
    revocationNote: 'Je kunt deze toegang op elk moment intrekken in Meta Business Settings → Partners.',
    copyCard: {
      label: 'Business-ID van het agency',
      helper: 'Tik één keer op Kopiëren en plak het in Meta Business Settings.',
      copyButton: 'Kopiëren',
      copied: 'Gekopieerd',
    },
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
