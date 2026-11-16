import type {
  AppNotification,
  BroadcastChannel,
  Chat,
  NicknameFontStyle,
  NoteItem,
  NotificationPrefs,
  Story,
  UserPrivate,
  UserPublic,
} from '../types/social';

export const USERNAME_REGEX = /^[a-z0-9_]{3,24}$/;
export const DOC_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

export const MAX_BIO_LENGTH = 150;
export const NICKNAME_COOLDOWN_DAYS = 7;
export const USERNAME_COOLDOWN_DAYS = 14;
export const NICKNAME_COOLDOWN_MS = NICKNAME_COOLDOWN_DAYS * 24 * 3_600_000;
export const USERNAME_COOLDOWN_MS = USERNAME_COOLDOWN_DAYS * 24 * 3_600_000;
export const BROADCAST_MIN_FOLLOWERS = 500;
export const MAX_GROUP_MEMBERS = 250;

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  pausedAll: false,
  follows: true,
  friendRequests: true,
  likes: true,
  comments: true,
  stories: true,
  messages: true,
  groupMessages: true,
  uploadProgress: true,
  mentions: true,
  announcements: true,
};

export const NICKNAME_FONT_CLASSES: Record<NicknameFontStyle, string> = {
  classic: 'font-display font-bold tracking-tight',
  serif: 'font-serif font-bold tracking-normal',
  mono: 'font-mono font-semibold tracking-tight',
  display: 'font-display font-extrabold tracking-wide uppercase',
  italic: 'font-serif italic font-semibold tracking-normal',
};

export const CHAT_THEME_PRESETS = [
  {
    id: 'default' as const,
    name: 'Liquid Glass',
    nameBn: 'লিকুইড গ্লাস',
    bgClass: 'bg-gradient-to-b from-slate-50/60 to-sky-50/40 dark:from-slate-950/60 dark:to-slate-900/60',
    bubbleMine: 'bg-gradient-to-br from-sky-500 to-blue-600 text-white',
    previewSwatch: 'from-sky-400 to-blue-600',
  },
  {
    id: 'love' as const,
    name: 'Love & Rose',
    nameBn: 'লাভ ও রোজ',
    bgClass: 'bg-gradient-to-b from-rose-100/80 via-pink-50/70 to-fuchsia-100/70 dark:from-rose-950/80 dark:via-pink-950/60 dark:to-slate-950/90',
    bubbleMine: 'bg-gradient-to-br from-rose-500 to-pink-600 text-white',
    previewSwatch: 'from-rose-400 to-pink-600',
  },
  {
    id: 'ocean' as const,
    name: 'Deep Ocean',
    nameBn: 'ডিপ ওশান',
    bgClass: 'bg-gradient-to-b from-cyan-100/80 via-sky-100/70 to-blue-100/80 dark:from-cyan-950/85 dark:via-sky-950/80 dark:to-slate-950/90',
    bubbleMine: 'bg-gradient-to-br from-cyan-500 to-teal-600 text-white',
    previewSwatch: 'from-cyan-400 to-teal-600',
  },
  {
    id: 'aurora' as const,
    name: 'Midnight Aurora',
    nameBn: 'মিডনাইট অরোরা',
    bgClass: 'bg-gradient-to-b from-indigo-100/80 via-violet-100/70 to-sky-100/70 dark:from-indigo-950/90 dark:via-violet-950/75 dark:to-slate-950/95',
    bubbleMine: 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white',
    previewSwatch: 'from-indigo-500 to-violet-600',
  },
  {
    id: 'sunset' as const,
    name: 'Golden Sunset',
    nameBn: 'সোনালী সন্ধ্যা',
    bgClass: 'bg-gradient-to-b from-amber-100/80 via-orange-50/70 to-rose-100/70 dark:from-amber-950/80 dark:via-orange-950/70 dark:to-slate-950/90',
    bubbleMine: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white',
    previewSwatch: 'from-amber-400 to-orange-600',
  },
  {
    id: 'emerald' as const,
    name: 'Emerald Mist',
    nameBn: 'এমারেল্ড মিস্ট',
    bgClass: 'bg-gradient-to-b from-emerald-100/80 via-teal-50/70 to-cyan-100/70 dark:from-emerald-950/85 dark:via-teal-950/70 dark:to-slate-950/90',
    bubbleMine: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white',
    previewSwatch: 'from-emerald-400 to-teal-600',
  },
];

export const REPORT_SUGGESTED_REASONS = [
  { id: 'spam', en: 'Spam or misleading links', bn: 'স্প্যাম বা বিভ্রান্তিকর লিংক' },
  { id: 'harassment', en: 'Harassment or bullying', bn: 'হয়রানি বা অপমানজনক আচরণ' },
  { id: 'impersonation', en: 'Pretending to be someone else', bn: 'ভুয়া পরিচয় বা ছদ্মবেশ' },
  { id: 'inappropriate', en: 'Inappropriate or unsafe content', bn: 'অনুপযুক্ত বা অনিরাপদ কনটেন্ট' },
  { id: 'scam', en: 'Scam, fraud, or suspicious activity', bn: 'প্রতারণা বা সন্দেহজনক কার্যকলাপ' },
];

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}

export function isValidUsername(username: string): boolean {
  return USERNAME_REGEX.test(username);
}

export const EMAIL_FORMAT_REGEX = /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;

// Strict signup provider allowlist: Gmail, Yahoo Mail, Hotmail, and Outlook/Microsoft only
export const ALLOWED_SIGNUP_EMAIL_DOMAINS = new Set<string>([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.co.in',
  'yahoo.in',
  'yahoo.ca',
  'yahoo.com.au',
  'ymail.com',
  'rocketmail.com',
  'hotmail.com',
  'hotmail.co.uk',
  'hotmail.fr',
  'hotmail.de',
  'hotmail.es',
  'hotmail.it',
  'outlook.com',
  'outlook.co.uk',
  'live.com',
  'msn.com',
]);

export const DISPOSABLE_EMAIL_DOMAINS = new Set<string>([
  '10mail.org',
  '10mail.tk',
  '10minutemail.co.uk',
  '10minutemail.com',
  '10minutemail.de',
  '10minutemail.net',
  '10minutemail.org',
  '10minutesmail.com',
  '10minemail.com',
  '1secmail.com',
  '1secmail.net',
  '1secmail.org',
  '20email.it',
  '20mail.it',
  '20minutemail.com',
  '20minutemail.it',
  '33mail.com',
  'anonaddy.me',
  'anonbox.net',
  'anonymbox.com',
  'antichef.com',
  'antichef.net',
  'binkmail.com',
  'bobmail.info',
  'bofthew.com',
  'boun.cr',
  'bouncr.com',
  'burnermail.io',
  'burstmail.info',
  'chacuo.net',
  'clrmail.com',
  'crazymailing.com',
  'curryworld.de',
  'deadaddress.com',
  'despam.it',
  'despammed.com',
  'devnullmail.com',
  'discard.email',
  'discardmail.com',
  'discardmail.de',
  'disposable.com',
  'disposableaddress.com',
  'disposableemailaddresses.com',
  'disposableinbox.com',
  'disposablemail.com',
  'disposeamail.com',
  'disposemail.com',
  'dispostable.com',
  'dodgeit.com',
  'dodgit.com',
  'donemail.ru',
  'dontreg.com',
  'dontsendmespam.de',
  'dpptd.com',
  'dropmail.me',
  'duck.com',
  'dump-email.info',
  'dumpandjunk.com',
  'dumpyemail.com',
  'e4ward.com',
  'easytrashmail.com',
  'email-temp.com',
  'email60.com',
  'emailage.cf',
  'emailage.ga',
  'emailage.gq',
  'emailage.ml',
  'emailage.tk',
  'emailfake.com',
  'emailfake.info',
  'emailgo.de',
  'emailias.com',
  'emailigo.de',
  'emailinfive.com',
  'emaillime.com',
  'emailmiser.com',
  'emailnator.com',
  'emailondeck.com',
  'emailproxsy.com',
  'emailsensei.com',
  'emailtemporanea.com',
  'emailtemporanea.net',
  'emailtemporar.ro',
  'emailtemporario.com.br',
  'emailthe.net',
  'emailtmp.com',
  'emailwarden.com',
  'emailx.at.hm',
  'emltmp.com',
  'ephemail.net',
  'esiix.com',
  'etempmail.com',
  'etranquil.com',
  'etranquil.net',
  'etranquil.org',
  'evopo.com',
  'explodemail.com',
  'express.net.ua',
  'eyepaste.com',
  'fake-mail.org',
  'fakeinbox.com',
  'fakeinformation.com',
  'fakemail.fr',
  'fakemail.net',
  'fakemailgenerator.com',
  'fastacura.com',
  'fastchevy.com',
  'fastchrysler.com',
  'fastkawasaki.com',
  'fastmazda.com',
  'fastmitsubishi.com',
  'fastnissan.com',
  'fastsubaru.com',
  'fastsuzuki.com',
  'fasttoyota.com',
  'fastyamaha.com',
  'filzmail.com',
  'fixmail.tk',
  'fleckens.hu',
  'fr33mail.info',
  'frapmail.com',
  'front14.org',
  'fudgerub.com',
  'garliclife.com',
  'generator.email',
  'get1mail.com',
  'get2mail.fr',
  'getairmail.com',
  'getmails.eu',
  'getnada.com',
  'getonemail.com',
  'gishpuppy.com',
  'gmial.com',
  'goemailgo.com',
  'gotmail.net',
  'gotmail.org',
  'gotti.otherinbox.com',
  'great-host.in',
  'greensloth.com',
  'grr.la',
  'guerrillamail.biz',
  'guerrillamail.com',
  'guerrillamail.de',
  'guerrillamail.info',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'h.mintemail.com',
  'harakirimail.com',
  'hartbot.de',
  'hat-geld.de',
  'hidemail.de',
  'hidzz.com',
  'hmamail.com',
  'hochsitze.com',
  'hotpop.com',
  'hulapla.de',
  'ieatspam.eu',
  'ieatspam.info',
  'ieh-mail.de',
  'ihateyoualot.info',
  'iheartspam.org',
  'imails.info',
  'inbox.si',
  'inboxalias.com',
  'inboxbear.com',
  'inboxclean.com',
  'inboxclean.org',
  'incognitomail.com',
  'incognitomail.net',
  'incognitomail.org',
  'insorg-mail.info',
  'instant-mail.de',
  'instantemailaddress.com',
  'ip6.li',
  'irish2me.com',
  'iwi.net',
  'jetable.com',
  'jetable.fr.nf',
  'jetable.net',
  'jetable.org',
  'jnxjn.com',
  'jourrapide.com',
  'junk1e.com',
  'kasmail.com',
  'kaspop.com',
  'keepmymail.com',
  'killmail.com',
  'killmail.net',
  'kismail.ru',
  'klassmaster.com',
  'klzlk.com',
  'koszmail.pl',
  'kurzepost.de',
  'lawlita.com',
  'letthemeatspam.com',
  'lhsdv.com',
  'lifebyfood.com',
  'link2mail.net',
  'litedrop.com',
  'lol.ovpn.to',
  'lolfreak.net',
  'lookugly.com',
  'lopl.co.cc',
  'lortemail.dk',
  'lr78.com',
  'lroid.com',
  'm4ilweb.info',
  'maboard.com',
  'mail-filter.com',
  'mail-temporaire.fr',
  'mail.by',
  'mail.mezimages.net',
  'mail2rss.org',
  'mail333.com',
  'mail4trash.com',
  'mailbidon.com',
  'mailblocks.com',
  'mailbucket.org',
  'mailcat.biz',
  'mailcatch.com',
  'mailde.de',
  'mailde.info',
  'maildrop.cc',
  'maildx.com',
  'maileater.com',
  'mailexpire.com',
  'mailfa.tk',
  'mailforspam.com',
  'mailfreeonline.com',
  'mailguard.me',
  'mailimate.com',
  'mailin8r.com',
  'mailinater.com',
  'mailinator.com',
  'mailinator.net',
  'mailinator.org',
  'mailinator2.com',
  'mailincubator.com',
  'mailismagic.com',
  'mailme.ir',
  'mailme.lv',
  'mailme24.com',
  'mailmetrash.com',
  'mailmoat.com',
  'mailnator.com',
  'mailnesia.com',
  'mailnull.com',
  'mailorg.org',
  'mailpick.biz',
  'mailpoof.com',
  'mailproxsy.com',
  'mailquack.com',
  'mailrock.biz',
  'mailscrap.com',
  'mailshell.com',
  'mailsiphon.com',
  'mailslite.com',
  'mailtemp.info',
  'mailtome.de',
  'mailtothis.com',
  'mailtrash.net',
  'mailtv.net',
  'mailtv.tv',
  'mailzi.ru',
  'mailzilla.com',
  'mailzilla.org',
  'makemetheking.com',
  'manybrain.com',
  'mbx.cc',
  'mega.zik.dj',
  'meinspamschutz.de',
  'melt.li',
  'meltmail.com',
  'messagebeamer.de',
  'mierdamail.com',
  'mintemail.com',
  'minuteinbox.com',
  'moakt.cc',
  'moakt.co',
  'moakt.com',
  'moburl.com',
  'mohmal.com',
  'mohmal.im',
  'mohmal.in',
  'mohmal.tech',
  'moncourrier.fr.nf',
  'monemail.fr.nf',
  'monmail.fr.nf',
  'monumentmail.com',
  'mt2009.com',
  'mt2014.com',
  'mvrht.net',
  'my10minutemail.com',
  'mycleaninbox.net',
  'mymail-in.net',
  'mypacks.net',
  'mypartyclip.de',
  'myphantomemail.com',
  'myspaceinc.com',
  'myspaceinc.net',
  'myspaceinc.org',
  'myspacepimpedup.com',
  'myspamless.com',
  'mytemp.email',
  'mytrashmail.com',
  'nada.email',
  'neomailbox.com',
  'nervmich.net',
  'nervtmich.net',
  'netmails.com',
  'netmails.net',
  'netzidiot.de',
  'neverbox.com',
  'nice-4u.com',
  'no-spam.ws',
  'noblepioneer.com',
  'nobulk.com',
  'noclickemail.com',
  'nogmailspam.info',
  'nomail.pw',
  'nomail.xl.cx',
  'nomail2me.com',
  'nomorespamemails.com',
  'nospam.ze.tc',
  'nospam4.us',
  'nospamfor.us',
  'nospamthanks.info',
  'notmailinator.com',
  'nowmymail.com',
  'nurfuerspam.de',
  'nus.edu.sg',
  'nwldx.com',
  'objectmail.com',
  'obobbo.com',
  'odaymail.com',
  'one-time.email',
  'oneoffemail.com',
  'onewaymail.com',
  'online.ms',
  'oopi.org',
  'opayq.com',
  'ordinaryamerican.net',
  'otherinbox.com',
  'ourklips.com',
  'outlawspam.com',
  'ovpn.to',
  'owlpic.com',
  'pancakemail.com',
  'pimpedupmyspace.com',
  'pjjkp.com',
  'plexolan.de',
  'poczta.onet.pl',
  'politikerclub.de',
  'poofy.org',
  'pookmail.com',
  'privacy.net',
  'privy-mail.com',
  'proxymail.eu',
  'prtnx.com',
  'putthisinyourspamdatabase.com',
  'quickinbox.com',
  'rcpt.at',
  'reallymymail.com',
  'realtyalerts.ca',
  'recode.me',
  'recursor.net',
  'regbypass.com',
  'regbypass.comsafe-mail.net',
  'rejectmail.com',
  'rhyta.com',
  'rklips.com',
  'rmqkr.net',
  'rppkn.com',
  'rtrtr.com',
  's0ny.net',
  'safe-mail.net',
  'safersignup.de',
  'safetymail.info',
  'safetypost.de',
  'sandelf.de',
  'saynotospams.com',
  'selfdestructingmail.com',
  'sendspamhere.com',
  'sharklasers.com',
  'shiftmail.com',
  'shitmail.me',
  'shitmail.org',
  'shortmail.net',
  'sibmail.com',
  'skeefmail.com',
  'slaskpost.se',
  'slopsbox.com',
  'smellfear.com',
  'snakemail.com',
  'sneakemail.com',
  'snkmail.com',
  'sofimail.com',
  'sofort-mail.de',
  'sogetthis.com',
  'soodonims.com',
  'spam.la',
  'spam.su',
  'spam4.me',
  'spamavert.com',
  'spambob.com',
  'spambob.net',
  'spambob.org',
  'spambog.com',
  'spambog.de',
  'spambog.ru',
  'spambox.info',
  'spambox.irishspringrealty.com',
  'spambox.us',
  'spamcannon.com',
  'spamcannon.net',
  'spamcero.com',
  'spamcon.org',
  'spamcorptastic.com',
  'spamcowboy.com',
  'spamcowboy.net',
  'spamcowboy.org',
  'spamday.com',
  'spamex.com',
  'spamfree.eu',
  'spamfree24.com',
  'spamfree24.de',
  'spamfree24.eu',
  'spamfree24.info',
  'spamfree24.net',
  'spamfree24.org',
  'spamgourmet.com',
  'spamgourmet.net',
  'spamgourmet.org',
  'spamherelots.com',
  'spamhereplease.com',
  'spamhole.com',
  'spamify.com',
  'spaminator.de',
  'spamkill.info',
  'spaml.com',
  'spaml.de',
  'spammotel.com',
  'spamobox.com',
  'spamoff.de',
  'spamslicer.com',
  'spamspot.com',
  'spamthis.co.uk',
  'spamthisplease.com',
  'spamtrail.com',
  'speed.1s.fr',
  'supergreatmail.com',
  'supermailer.jp',
  'suremail.info',
  'teewars.org',
  'teleworm.com',
  'teleworm.us',
  'temp-mail.de',
  'temp-mail.io',
  'temp-mail.org',
  'temp-mail.ru',
  'tempail.com',
  'tempalias.com',
  'tempe-mail.com',
  'tempemail.biz',
  'tempemail.co.za',
  'tempemail.com',
  'tempemail.net',
  'tempinbox.co.uk',
  'tempinbox.com',
  'tempmail.co',
  'tempmail.com',
  'tempmail.de',
  'tempmail.eu',
  'tempmail.it',
  'tempmail.net',
  'tempmail.org',
  'tempmail.plus',
  'tempmail.us',
  'tempmail2.com',
  'tempmaildemo.com',
  'tempmailer.com',
  'tempmailer.de',
  'tempmailo.com',
  'tempomail.fr',
  'temporaryemail.net',
  'temporaryemail.us',
  'temporaryforwarding.com',
  'temporaryinbox.com',
  'temporarymailaddress.com',
  'tempr.email',
  'thanksnospam.info',
  'thankyou2010.com',
  'thisisnotmyrealemail.com',
  'throwawayemailaddress.com',
  'throwawaymail.com',
  'tilien.com',
  'tmail.ws',
  'tmailinator.com',
  'tmpmail.net',
  'tmpmail.org',
  'tradermail.info',
  'trash-amil.com',
  'trash-mail.at',
  'trash-mail.com',
  'trash-mail.de',
  'trash2009.com',
  'trashemail.de',
  'trashmail.at',
  'trashmail.com',
  'trashmail.de',
  'trashmail.me',
  'trashmail.net',
  'trashmail.org',
  'trashmail.ws',
  'trashmailer.com',
  'trashymail.com',
  'trashymail.net',
  'trbvm.com',
  'trialmail.de',
  'tyldd.com',
  'uggsrock.com',
  'upliftnow.com',
  'uplipht.com',
  'venompen.com',
  'veryrealemail.com',
  'viditag.com',
  'viewcastmedia.com',
  'viewcastmedia.net',
  'viewcastmedia.org',
  'webm4il.info',
  'wegwerfadresse.de',
  'wegwerfemail.com',
  'wegwerfemail.de',
  'wegwerfmail.de',
  'wegwerfmail.info',
  'wegwerfmail.net',
  'wegwerfmail.org',
  'wetrainbayarea.com',
  'wetrainbayarea.org',
  'wh4f.org',
  'whyspam.me',
  'willselfdestruct.com',
  'winemaven.info',
  'wronghead.com',
  'wuzup.net',
  'wuzupmail.net',
  'wwwnew.eu',
  'xagloo.com',
  'xemaps.com',
  'xents.com',
  'xmaily.com',
  'xoxy.net',
  'yep.it',
  'yogamaven.com',
  'fviainboxes.com',
  'gmailnator.com',
  'inboxkitten.com',
  'inboxes.com',
  'instaddr.ch',
  'internxt.com',
  'kuku.lu',
  'linshiyouxiang.net',
  'm.kuku.lu',
  'mail-temp.com',
  'mail.gw',
  'mail.td',
  'mail.tm',
  'mail7.io',
  'mailsac.com',
  'minutemail.cc',
  'mozmail.com',
  'oosln.com',
  'passinbox.com',
  'passmail.net',
  'pokemail.net',
  'relay.firefox.com',
  'rteet.com',
  'simplelogin.co',
  'simplelogin.com',
  'slmail.me',
  'snapmail.cc',
  'temp-mail.live',
  'tempinbox.xyz',
  'tempmail.cc',
  'tempmail.dev',
  'tempmail.ninja',
  'tempmail.ws',
  'tmail.gg',
  'tmail.io',
  'tmailor.com',
  'tmpmail.com',
  'trashmail.io',
  'txen.de',
  'vddaz.com',
  'vmani.com',
  'wwjmp.com',
  'yopmail.info',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'yuurok.com',
  'zehnminutenmail.de',
  'zippymail.info',
  'zoaxe.com',
  'zoemail.net',
  'zoemail.org',
]);

export const DISPOSABLE_HOST_PATTERN =
  /(^|\.)(tempmail|temp-mail|tmpmail|mail-temp|email-temp|1secmail|10minutemail|10minemail|20minutemail|guerrillamail|mailinator|yopmail|trashmail|throwawaymail|disposable|burnermail|fakeinbox|fakemail|emailfake|emailnator|gmailnator|tmailor|fviainboxes|inboxkitten|linshiyouxiang|snapmail|etempmail|pokemail|getnada|maildrop|mohmal|moakt|emltmp|mytemp|tempr|sharklasers|mailnesia|emailondeck|dropmail|minuteinbox|dispostable|wegwerfmail|spam4|mailsac|anonaddy|simplelogin|mozmail)\b/i;

export function isValidEmailFormat(email: string): boolean {
  const clean = email.trim().toLowerCase();
  return clean.length <= 254 && EMAIL_FORMAT_REGEX.test(clean);
}

export function isDisposableEmail(email: string): boolean {
  const clean = email.trim().toLowerCase();
  const atIdx = clean.lastIndexOf('@');
  if (atIdx < 1) return false;
  const domain = clean.slice(atIdx + 1).replace(/\.+$/, '');
  if (!domain) return true;
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return true;

  // Check parent domains for subdomain temp mail (e.g. a.b.yopmail.com)
  const labels = domain.split('.');
  for (let i = 1; i < labels.length - 1; i++) {
    const parent = labels.slice(i).join('.');
    if (DISPOSABLE_EMAIL_DOMAINS.has(parent)) return true;
  }

  return DISPOSABLE_HOST_PATTERN.test(domain);
}

export function canonicalizeEmail(email: string): string {
  const clean = email.trim().toLowerCase();
  const atIdx = clean.lastIndexOf('@');
  if (atIdx < 1) return clean;
  let local = clean.slice(0, atIdx);
  let domain = clean.slice(atIdx + 1);

  if (domain === 'googlemail.com') {
    domain = 'gmail.com';
  }
  if (domain === 'gmail.com') {
    const plusIdx = local.indexOf('+');
    if (plusIdx !== -1) local = local.slice(0, plusIdx);
    local = local.replace(/\./g, '');
  } else if (
    domain === 'outlook.com' ||
    domain === 'hotmail.com' ||
    domain === 'live.com' ||
    domain === 'icloud.com' ||
    domain === 'me.com' ||
    domain === 'proton.me' ||
    domain === 'protonmail.com' ||
    domain === 'yahoo.com'
  ) {
    const plusIdx = local.indexOf('+');
    if (plusIdx !== -1) local = local.slice(0, plusIdx);
  }
  return `${local}@${domain}`;
}

export function getEmailDomain(email: string): string {
  const clean = email.trim().toLowerCase();
  const atIdx = clean.lastIndexOf('@');
  if (atIdx < 1) return '';
  return clean.slice(atIdx + 1).replace(/\.+$/, '');
}

export function isAllowedSignupEmailProvider(email: string): boolean {
  const domain = getEmailDomain(email);
  if (!domain) return false;
  return ALLOWED_SIGNUP_EMAIL_DOMAINS.has(domain);
}

export function validateSignupEmail(
  email: string,
  lang: 'en' | 'bn' = 'en'
): { valid: boolean; reason?: string; cleanEmail: string; canonicalEmail: string } {
  const cleanEmail = email.trim().toLowerCase();
  if (!isValidEmailFormat(cleanEmail)) {
    return {
      valid: false,
      cleanEmail,
      canonicalEmail: cleanEmail,
      reason:
        lang === 'bn'
          ? 'সঠিক একটি ইমেইল ঠিকানা লিখুন (যেমন: name@gmail.com)।'
          : 'Please enter a valid email address (e.g. name@gmail.com).',
    };
  }
  if (isDisposableEmail(cleanEmail) || !isAllowedSignupEmailProvider(cleanEmail)) {
    return {
      valid: false,
      cleanEmail,
      canonicalEmail: canonicalizeEmail(cleanEmail),
      reason:
        lang === 'bn'
          ? 'এই টেম্পোরারি বা অসমর্থিত ইমেইল অনুমোদিত নয়। শুধুমাত্র Gmail, Yahoo, Hotmail এবং Outlook ব্যবহার করা যাবে।'
          : 'This disposable or unsupported email is not allowed. Only Gmail, Yahoo Mail, Hotmail, and Outlook are permitted.',
    };
  }
  return {
    valid: true,
    cleanEmail,
    canonicalEmail: canonicalizeEmail(cleanEmail),
  };
}

export function isValidDisplayName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= 50;
}

export function isValidBio(bio: string): boolean {
  return bio.length <= MAX_BIO_LENGTH;
}

export function isValidPostCaption(caption: string): boolean {
  return caption.trim().length >= 1 && caption.length <= 2200;
}

export function isValidCommentText(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length >= 1 && trimmed.length <= 1000;
}

export function getCooldownStatus(
  lastChangedAt: string | null | undefined,
  cooldownMs: number,
  nowMs: number = Date.now()
): { allowed: boolean; remainingDays: number; nextAllowedAt: string | null } {
  if (!lastChangedAt) {
    return { allowed: true, remainingDays: 0, nextAllowedAt: null };
  }
  const parsed = Date.parse(lastChangedAt);
  if (Number.isNaN(parsed)) {
    return { allowed: true, remainingDays: 0, nextAllowedAt: null };
  }
  const elapsed = nowMs - parsed;
  if (elapsed >= cooldownMs) {
    return { allowed: true, remainingDays: 0, nextAllowedAt: null };
  }
  const remainingMs = cooldownMs - elapsed;
  const remainingDays = Math.max(1, Math.ceil(remainingMs / (24 * 3_600_000)));
  return {
    allowed: false,
    remainingDays,
    nextAllowedAt: new Date(parsed + cooldownMs).toISOString(),
  };
}

export function canChangeNickname(
  lastNicknameChangedAt: string | null | undefined,
  nowMs: number = Date.now()
) {
  return getCooldownStatus(lastNicknameChangedAt, NICKNAME_COOLDOWN_MS, nowMs);
}

export function canChangeUsername(
  lastUsernameChangedAt: string | null | undefined,
  nowMs: number = Date.now()
) {
  return getCooldownStatus(lastUsernameChangedAt, USERNAME_COOLDOWN_MS, nowMs);
}

export function canOpenBroadcastChannel(followersCount: number): boolean {
  return followersCount >= BROADCAST_MIN_FOLLOWERS;
}

export function getMaskedUserDisplay(
  user: Pick<UserPublic, 'displayName' | 'username' | 'isDeactivated'>,
  viewerUid: string | null,
  targetUid: string
): { displayName: string; username: string; isDeactivatedView: boolean } {
  if (user.isDeactivated && viewerUid !== targetUid) {
    return {
      displayName: 'SocialVerse User',
      username: 'socialverse_user',
      isDeactivatedView: true,
    };
  }
  return {
    displayName: user.displayName,
    username: user.username,
    isDeactivatedView: false,
  };
}

export function canViewPrivateProfileContent(
  profileUser: Pick<UserPublic, 'uid' | 'isPrivate' | 'isDeactivated'>,
  viewerUid: string | null,
  followingIds: string[]
): boolean {
  if (profileUser.isDeactivated && viewerUid !== profileUser.uid) return false;
  if (!profileUser.isPrivate) return true;
  if (viewerUid && viewerUid === profileUser.uid) return true;
  return followingIds.includes(profileUser.uid);
}

export function isGroupOwner(chat: Pick<Chat, 'ownerUid' | 'createdBy'>, uid: string): boolean {
  return (chat.ownerUid || chat.createdBy) === uid;
}

export function isGroupAdmin(chat: Pick<Chat, 'ownerUid' | 'createdBy' | 'adminUids'>, uid: string): boolean {
  return isGroupOwner(chat, uid) || Boolean(chat.adminUids?.includes(uid));
}

export function canRemoveGroupMember(
  chat: Pick<Chat, 'ownerUid' | 'createdBy' | 'adminUids'>,
  actorUid: string,
  targetUid: string
): boolean {
  if (isGroupOwner(chat, targetUid)) return false; // Nobody can remove the owner
  if (actorUid === targetUid) return true; // Leave group
  if (isGroupOwner(chat, actorUid)) return true; // Owner can remove anyone else
  if (isGroupAdmin(chat, actorUid)) {
    return !isGroupAdmin(chat, targetUid); // Admins can remove regular members
  }
  return false;
}

export function canAddGroupMembers(
  chat: Pick<Chat, 'participantIds' | 'maxMembers' | 'requireAddApproval' | 'ownerUid' | 'createdBy' | 'adminUids'>,
  actorUid: string
): { allowed: boolean; needsApproval: boolean; reason?: string } {
  const cap = chat.maxMembers || MAX_GROUP_MEMBERS;
  if (chat.participantIds.length >= cap) {
    return { allowed: false, needsApproval: false, reason: `Group limit (${cap} members) reached.` };
  }
  if (isGroupAdmin(chat, actorUid)) {
    return { allowed: true, needsApproval: false };
  }
  if (chat.requireAddApproval) {
    return { allowed: true, needsApproval: true };
  }
  return { allowed: true, needsApproval: false };
}

export function canSendInGroupChat(
  chat: Pick<Chat, 'type' | 'ownerUid' | 'createdBy' | 'adminUids' | 'restrictions'>,
  uid: string,
  messageType: 'text' | 'voice' | 'image' | 'video' | 'file' | 'sticker' | 'reel_share' = 'text'
): { allowed: boolean; reason?: string } {
  if (chat.type !== 'group') return { allowed: true };
  if (isGroupAdmin(chat, uid)) return { allowed: true };
  if (chat.restrictions?.adminsOnlyMessages) {
    return { allowed: false, reason: 'Only group admins can send messages.' };
  }
  if (
    chat.restrictions?.blockMediaAttachments &&
    (messageType === 'image' || messageType === 'video' || messageType === 'file' || messageType === 'voice')
  ) {
    return { allowed: false, reason: 'Media and file sharing is restricted by group admins.' };
  }
  return { allowed: true };
}

export function canEditGroupInfo(
  chat: Pick<Chat, 'type' | 'ownerUid' | 'createdBy' | 'adminUids' | 'restrictions' | 'participantIds'>,
  uid: string
): boolean {
  if (chat.type !== 'group' || !chat.participantIds.includes(uid)) return false;
  if (isGroupAdmin(chat, uid)) return true;
  return chat.restrictions?.onlyAdminsEditInfo === false;
}

export function isValidHighlightTitle(title: string): boolean {
  const clean = title.trim();
  return clean.length >= 1 && clean.length <= 36;
}

export function isHomeStoryVisibleToUser(
  story: Pick<Story, 'authorId' | 'expiresAt' | 'privacy'> & { viewerInCloseFriends?: boolean },
  author: Pick<UserPublic, 'uid' | 'isPrivate' | 'isDeactivated'> | undefined,
  viewerUid: string | null,
  followingIds: string[],
  nowMs: number = Date.now(),
  authorCloseFriendUids?: string[]
): boolean {
  if (!isStoryActive(story, nowMs)) return false;
  if (!author || author.isDeactivated) return false;
  if (viewerUid && story.authorId === viewerUid) return true;
  if (!viewerUid) return false;
  if (story.privacy === 'close_friends') {
    if (story.viewerInCloseFriends) return true;
    return Boolean(authorCloseFriendUids && authorCloseFriendUids.includes(viewerUid));
  }
  if (!followingIds.includes(story.authorId)) return false;
  return true;
}

export function isNoteVisibleToUser(
  note: Pick<NoteItem, 'authorUid' | 'expiresAt' | 'audience'> & { viewerInCloseFriends?: boolean },
  author: Pick<UserPublic, 'uid' | 'isPrivate' | 'isDeactivated'> | undefined,
  viewerUid: string | null,
  followingIds: string[],
  nowMs: number = Date.now(),
  authorCloseFriendUids?: string[]
): boolean {
  const exp = Date.parse(note.expiresAt);
  if (Number.isNaN(exp) || exp <= nowMs) return false;
  if (!author || author.isDeactivated) return false;
  if (viewerUid && note.authorUid === viewerUid) return true;
  if (!viewerUid) return false;
  if (note.audience === 'close_friends') {
    if (note.viewerInCloseFriends) return true;
    return Boolean(authorCloseFriendUids && authorCloseFriendUids.includes(viewerUid));
  }
  if (author.isPrivate && !followingIds.includes(note.authorUid)) return false;
  return true;
}

export function shouldNotifyUser(
  prefs: Partial<NotificationPrefs> | undefined,
  type: AppNotification['type'] | 'upload',
  isMutedChat: boolean = false
): boolean {
  if (isMutedChat) return false;
  const merged = { ...DEFAULT_NOTIFICATION_PREFS, ...(prefs || {}) };
  if (merged.pausedAll) return false;
  switch (type) {
    case 'follow':
      return merged.follows !== false;
    case 'friend_request':
      return merged.friendRequests !== false;
    case 'like':
      return merged.likes !== false;
    case 'comment':
    case 'reply':
      return merged.comments !== false;
    case 'story_reaction':
      return merged.stories !== false;
    case 'message':
      return merged.messages !== false;
    case 'group_message':
      return merged.groupMessages !== false;
    case 'mention':
      return merged.mentions !== false;
    case 'announcement':
      return merged.announcements !== false;
    case 'upload':
      return merged.uploadProgress !== false;
    default:
      return true;
  }
}

export function canPostInBroadcast(
  channel: Pick<BroadcastChannel, 'ownerUid' | 'adminUids' | 'collaboratorUids'>,
  uid: string
): boolean {
  return (
    channel.ownerUid === uid ||
    channel.adminUids.includes(uid) ||
    channel.collaboratorUids.includes(uid)
  );
}

export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[a-zA-Z0-9_\u0980-\u09FF]{1,40}/g);
  if (!matches) return [];
  const unique = new Set(matches.map((tag) => tag.slice(1).toLowerCase()));
  return Array.from(unique).slice(0, 20);
}

export function isStoryActive(story: Pick<Story, 'expiresAt'>, nowMs: number = Date.now()): boolean {
  const exp = Date.parse(story.expiresAt);
  if (Number.isNaN(exp)) return false;
  return exp > nowMs;
}

export function canMessageUser(
  recipientPrivacy: Pick<UserPrivate, 'whoCanMessage' | 'blockedUserIds'>,
  senderUid: string,
  isFollower: boolean
): boolean {
  if (recipientPrivacy.blockedUserIds.includes(senderUid)) return false;
  if (recipientPrivacy.whoCanMessage === 'nobody') return false;
  if (recipientPrivacy.whoCanMessage === 'followers') return isFollower;
  return true;
}

export function requiresFollowApproval(
  targetPublic: Pick<UserPublic, 'isPrivate'> | undefined,
  targetPrivate?: Pick<UserPrivate, 'whoCanFollow'> | undefined
): boolean {
  if (targetPublic?.isPrivate) return true;
  if (targetPrivate?.whoCanFollow === 'approval') return true;
  return false;
}

export function formatCompactCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.max(0, Math.floor(count)));
}

export function formatRelativeTime(isoDate: string, lang: 'en' | 'bn' = 'en'): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - Date.parse(isoDate)) / 1000));
  if (Number.isNaN(diffSec)) return '';
  if (diffSec < 60) return lang === 'bn' ? 'এইমাত্র' : 'Just now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return lang === 'bn' ? `${mins} মি.` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return lang === 'bn' ? `${hrs} ঘ.` : `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return lang === 'bn' ? `${days} দিন` : `${days}d`;
}

export function isValidWebsiteUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return true;
  if (trimmed.length > 200) return false;
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProto);
    return Boolean(parsed.hostname && parsed.hostname.includes('.'));
  } catch {
    return false;
  }
}

export function normalizeWebsiteUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export const DATE_OF_BIRTH_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const MIN_SIGNUP_AGE_YEARS = 13;

export function isValidDateOfBirth(
  raw: string,
  nowMs: number = Date.now()
): {
  valid: boolean;
  normalized: string;
  reason?: 'format' | 'invalid_date' | 'future' | 'too_old' | 'too_young';
} {
  const normalized = (raw || '').trim();
  if (!DATE_OF_BIRTH_REGEX.test(normalized)) {
    return { valid: false, normalized, reason: 'format' };
  }
  const [yStr, mStr, dStr] = normalized.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { valid: false, normalized, reason: 'invalid_date' };
  }
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return { valid: false, normalized, reason: 'invalid_date' };
  }
  if (year < 1900) {
    return { valid: false, normalized, reason: 'too_old' };
  }
  const nowDate = new Date(nowMs);
  const todayUtcMs = Date.UTC(
    nowDate.getUTCFullYear(),
    nowDate.getUTCMonth(),
    nowDate.getUTCDate()
  );
  if (parsed.getTime() > todayUtcMs) {
    return { valid: false, normalized, reason: 'future' };
  }

  let age = nowDate.getUTCFullYear() - year;
  const monthDiff = nowDate.getUTCMonth() + 1 - month;
  if (monthDiff < 0 || (monthDiff === 0 && nowDate.getUTCDate() < day)) {
    age -= 1;
  }
  if (age < MIN_SIGNUP_AGE_YEARS) {
    return { valid: false, normalized, reason: 'too_young' };
  }
  return { valid: true, normalized };
}

export function formatCalendarDate(
  raw: string | null | undefined,
  lang: 'en' | 'bn' = 'en'
): string {
  const trimmed = (raw || '').trim();
  if (!trimmed) return '';
  const locale = lang === 'bn' ? 'bn-BD' : 'en-US';
  if (DATE_OF_BIRTH_REGEX.test(trimmed)) {
    const [yStr, mStr, dStr] = trimmed.split('-');
    const year = Number(yStr);
    const month = Number(mStr);
    const day = Number(dStr);
    const utcDate = new Date(Date.UTC(year, month - 1, day));
    if (
      utcDate.getUTCFullYear() !== year ||
      utcDate.getUTCMonth() !== month - 1 ||
      utcDate.getUTCDate() !== day
    ) {
      return trimmed;
    }
    try {
      return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
      }).format(utcDate);
    } catch {
      return trimmed;
    }
  }
  const parsedMs = Date.parse(trimmed);
  if (Number.isNaN(parsedMs)) return '';
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(parsedMs));
  } catch {
    return trimmed.slice(0, 10);
  }
}

export function mapFirebaseAuthError(error: unknown, lang: 'en' | 'bn' = 'en'): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';
  const msg = error instanceof Error ? error.message : String(error || '');
  const full = `${code} ${msg}`;

  if (full.includes('auth/operation-not-allowed')) {
    return lang === 'bn'
      ? 'সাইন-ইন পদ্ধতি চালু নেই। ইমেইল ওটিপি বা ইউজারনেম লগইন ব্যবহার করুন।'
      : 'Email/Password provider is disabled in Firebase Console for project socialvars.';
  }
  if (full.includes('auth/email-already-in-use')) {
    return lang === 'bn'
      ? 'এই ইমেইল দিয়ে ইতিমধ্যেই অ্যাকাউন্ট তৈরি করা আছে। অনুগ্রহ করে সাইন ইন করুন।'
      : 'An account with this email already exists. Try signing in instead.';
  }
  if (
    full.includes('auth/invalid-credential') ||
    full.includes('auth/wrong-password') ||
    full.includes('auth/user-not-found')
  ) {
    return lang === 'bn'
      ? 'ইমেইল/ইউজারনেম বা পাসওয়ার্ড সঠিক নয়। আবার চেষ্টা করুন।'
      : 'Incorrect email/username or password. Please check and try again.';
  }
  if (full.includes('auth/weak-password')) {
    return lang === 'bn'
      ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।'
      : 'Password must be at least 6 characters.';
  }
  if (full.includes('auth/invalid-email')) {
    return lang === 'bn'
      ? 'সঠিক ইমেইল ঠিকানা লিখুন।'
      : 'Please enter a valid email address.';
  }
  if (full.includes('auth/too-many-requests')) {
    return lang === 'bn'
      ? 'অনেকবার চেষ্টা করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।'
      : 'Too many attempts. Please wait a moment and try again.';
  }
  if (full.includes('auth/popup-closed-by-user') || full.includes('auth/cancelled-popup-request')) {
    return lang === 'bn'
      ? 'গুগল সাইন-ইন পপআপ বন্ধ করা হয়েছে। আবার চেষ্টা করুন।'
      : 'Google sign-in popup was closed before completing. Try again.';
  }
  if (full.includes('auth/popup-blocked')) {
    return lang === 'bn'
      ? 'ব্রাউজার পপআপ ব্লক করেছে। পপআপ অনুমতি দিয়ে আবার চেষ্টা করুন।'
      : 'Browser blocked the sign-in popup. Allow popups or use email sign-in below.';
  }
  if (full.includes('auth/unauthorized-domain')) {
    return lang === 'bn'
      ? 'এই ডোমেইনটি Firebase Auth-এ অনুমোদিত নয়। ইমেইল সাইন-ইন ব্যবহার করুন।'
      : 'This preview domain is not authorized for OAuth popups in Firebase Console. Use email sign-in below.';
  }
  if (full.includes('auth/network-request-failed')) {
    return lang === 'bn'
      ? 'নেটওয়ার্ক সংযোগে সমস্যা হয়েছে। ইন্টারনেট যাচাই করুন।'
      : 'Network error connecting to server. Check your connection and retry.';
  }
  return msg || (lang === 'bn' ? 'সাইন ইন সম্পন্ন করা যায়নি।' : 'Authentication failed. Please try again.');
}

const PROTECTED_SUBSCREENS = new Set<string>([
  'notifications',
  'saved',
  'ai_assistant',
  'edit_profile',
  'followers',
  'following',
  'friend_requests',
  'create_sheet',
  'broadcast_channel',
  'report',
  'story_creator',
  'highlight_creator',
  'android_project',
  'settings_home',
  'settings_notifications',
  'settings_privacy',
  'settings_security',
  'settings_account',
  'settings_blocked',
  'settings_language',
  'settings_about',
]);

export function isProtectedAppRoute(params: {
  activeTab: string;
  subscreen?: string | null;
  viewedProfileUid?: string | null;
  currentUid?: string | null;
}): boolean {
  const { activeTab, subscreen, viewedProfileUid, currentUid } = params;
  if (subscreen && PROTECTED_SUBSCREENS.has(subscreen)) {
    return true;
  }
  if (activeTab === 'messages') {
    return true;
  }
  if (activeTab === 'profile') {
    const viewingPublicOther = Boolean(viewedProfileUid && viewedProfileUid !== (currentUid || ''));
    return !viewingPublicOther;
  }
  return false;
}

export function evaluateRouteAccess(params: {
  activeTab: string;
  subscreen?: string | null;
  viewedProfileUid?: string | null;
  currentUid?: string | null;
  isAuthenticated: boolean;
  authReady: boolean;
}): {
  protectedRoute: boolean;
  decision: 'loading' | 'allow' | 'require_auth';
} {
  const protectedRoute = isProtectedAppRoute(params);
  if (!params.authReady) {
    return { protectedRoute, decision: 'loading' };
  }
  if (protectedRoute && !params.isAuthenticated) {
    return { protectedRoute, decision: 'require_auth' };
  }
  return { protectedRoute, decision: 'allow' };
}

export function parseAppRouteFromLocation(
  pathname: string,
  hash: string = '',
  search: string = ''
): {
  tab: 'home' | 'reels' | 'messages' | 'explore' | 'profile';
  subscreen:
    | null
    | 'notifications'
    | 'settings_home'
    | 'create_sheet';
} {
  const params = new URLSearchParams(search || '');
  const tabParam = (params.get('tab') || '').toLowerCase();
  const cleanHash = (hash || '').replace(/^#\/?/, '').toLowerCase().split('?')[0];
  const cleanPath = (pathname || '').replace(/^\/+|\/+$/g, '').toLowerCase();
  const routeSegment = tabParam || cleanHash || cleanPath;

  if (routeSegment === 'reels') return { tab: 'reels', subscreen: null };
  if (routeSegment === 'explore') return { tab: 'explore', subscreen: null };
  if (routeSegment === 'messages' || routeSegment === 'inbox') {
    return { tab: 'messages', subscreen: null };
  }
  if (routeSegment === 'profile') return { tab: 'profile', subscreen: null };
  if (routeSegment === 'notifications') return { tab: 'home', subscreen: 'notifications' };
  if (routeSegment === 'settings') return { tab: 'home', subscreen: 'settings_home' };
  if (routeSegment === 'create') return { tab: 'home', subscreen: 'create_sheet' };
  return { tab: 'home', subscreen: null };
}

