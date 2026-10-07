// Emoji deposu verisi: kategoriler + Türkçe arama sözcükleri.
export type EmojiKategori = { id: string; simge: string; ad: string; liste: string[] };

const parcala = (s: string): string[] => {
  const bol = (globalThis as { Intl?: { Segmenter?: new (l?: string, o?: object) => { segment(s: string): Iterable<{ segment: string }> } } }).Intl?.Segmenter;
  const ham = bol ? Array.from(new bol(undefined, { granularity: "grapheme" }).segment(s.replace(/\s+/g, "")), (x) => x.segment) : Array.from(s.replace(/\s+/g, ""));
  return ham;
};

export const KATEGORILER: EmojiKategori[] = [
  { id: "yuz", simge: "😀", ad: "Yüzler", liste: parcala(`
😀😃😄😁😆😅🤣😂🙂🙃😉😊😇🥰😍🤩😘😗😚😙😋😛😜🤪😝🤑🤗🤭🤫🤔🤐🤨😐😑😶😏😒🙄😬🤥😌😔😪🤤😴😷🤒🤕🤢🤮🤧🥵🥶🥴😵🤯🤠🥳😎🤓🧐😕😟🙁☹️😮😯😲😳🥺😦😧😨😰😥😢😭😱😖😣😞😓😩😫🥱😤😡😠🤬😈👿💀☠️💩🤡👹👺👻👽👾🤖😺😸😹😻😼😽🙀😿😾🙈🙉🙊`) },
  { id: "el", simge: "👍", ad: "El & İnsan", liste: parcala(`
👋🤚🖐️✋🖖👌🤌🤏✌️🤞🤟🤘🤙👈👉👆🖕👇☝️👍👎✊👊🤛🤜👏🙌👐🤲🤝🙏✍️💅🤳💪🦾🦵🦶👂👃🧠🫀🫁🦷👀👁️👅👄💋🧑👶👦👧👨👩🧔👴👵🙍🙎🙅🙆💁🙋🙇🤦🤷💆💇🚶🏃💃🕺🧘`) },
  { id: "kalp", simge: "❤️", ad: "Kalp & Semboller", liste: parcala(`
❤️🧡💛💚💙💜🖤🤍🤎💔❣️💕💞💓💗💖💘💝💟☮️✝️☪️🕉️☯️♈♉♊♋♌♍♎♏♐♑♒♓🔥💥✨🌟⭐💫💯💢💦💨🕳️💬💭🗯️💤✅❌❓❗❕❔‼️⁉️⚠️🚫⛔📛🔞♻️✔️➕➖➗✖️♾️💲©️®️™️🔴🟠🟡🟢🔵🟣⚫⚪🟤🔶🔷🔺🔻`) },
  { id: "hayvan", simge: "🐶", ad: "Hayvanlar", liste: parcala(`
🐶🐱🐭🐹🐰🦊🐻🐼🐨🐯🦁🐮🐷🐸🐵🙈🐔🐧🐦🐤🦆🦅🦉🦇🐺🐗🐴🦄🐝🐛🦋🐌🐞🐜🕷️🦂🐢🐍🦎🐙🦑🦐🦀🐡🐠🐟🐬🐳🐋🦈🐊🐅🐆🦓🦍🐘🦏🦛🐪🐫🦒🐃🐂🐄🐎🐖🐏🐑🐐🦌🐕🐩🐈🐓🦃🦚🦜🦢🐇🦝🦨🦔🐾🐉🐲🌵🎄🌲🌳🌴🌱🌿☘️🍀🍁🍂🍃🌺🌻🌹🌷🌼🌸💐🍄🌾`) },
  { id: "yemek", simge: "🍕", ad: "Yiyecek & İçecek", liste: parcala(`
🍏🍎🍐🍊🍋🍌🍉🍇🍓🍈🍒🍑🥭🍍🥥🥝🍅🍆🥑🥦🥒🌶️🌽🥕🥔🍠🥐🍞🥖🧀🥚🍳🥞🥓🥩🍗🍖🌭🍔🍟🍕🥪🌮🌯🥗🍝🍜🍲🍛🍣🍱🥟🍤🍙🍚🍘🍥🍢🍡🍧🍨🍦🥧🧁🍰🎂🍮🍭🍬🍫🍿🍩🍪🌰🥜🍯🥛☕🍵🧃🥤🍶🍺🍻🥂🍷🥃🍸🍹🍾🧊🥄🍴🍽️🥢`) },
  { id: "aktivite", simge: "🎮", ad: "Oyun & Aktivite", liste: parcala(`
⚽🏀🏈⚾🥎🎾🏐🏉🎱🏓🏸🥅🏒🏑🏏⛳🏹🎣🥊🥋🎽🛹🛼⛸️🎿🏂🏋️🤸⛹️🤺🏇🏊🚴🏆🥇🥈🥉🏅🎖️🎗️🎫🎟️🎪🎭🎨🎬🎤🎧🎼🎹🥁🎷🎺🎸🎻🎲🧩♟️🎯🎳🎮🕹️👾🎰🧸🪀🪁🎁🎈🎉🎊🎀🪄`) },
  { id: "seyahat", simge: "🚗", ad: "Seyahat & Yerler", liste: parcala(`
🚗🚕🚙🚌🚎🏎️🚓🚑🚒🚐🚚🚛🚜🛵🏍️🚲🛴🚨🚔🚍🚘🚖🚂🚆🚄🚅🚇🚊✈️🛫🛬🚀🛸🚁⛵🚤🛥️🚢⚓⛽🚧🚦🚥🗺️🗿🗽🗼🏰🏯🏟️🎡🎢🎠⛲⛱️🏖️🏝️🏜️🌋⛰️🏔️🗻🏕️🏠🏡🏢🏥🏦🏪🏫🏭🕌⛪🕍🌃🌆🌇🌉🌌🌍🌎🌏🌙🌛🌞☀️⛅☁️🌧️⛈️🌩️❄️☃️🌈☔⚡🌊`) },
  { id: "nesne", simge: "💡", ad: "Nesneler", liste: parcala(`
⌚📱💻⌨️🖥️🖨️🖱️💽💾💿📷📸📹🎥📞☎️📺📻🎙️⏰⏳⌛📡🔋🔌💡🔦🕯️💸💵💴💶💷💰💳💎⚖️🔧🔨⚒️🛠️⛏️🔩⚙️🔫💣🔪🛡️🚬⚰️🔮📿💈⚗️🔭🔬💊💉🩹🧬🦠🧪🌡️🧹🧺🧻🚽🚿🛁🔑🗝️🚪🛏️🛋️🖼️🛍️📦📫📮📝📁📂📅📆📈📉📊📌📍📎✂️🗑️🔒🔓🔔🔕📣📢📖📚🔖🏷️`) },
  { id: "bayrak", simge: "🚩", ad: "Bayraklar", liste: parcala(`
🏁🚩🎌🏴🏳️🏳️‍🌈🇹🇷🇦🇿🇩🇪🇫🇷🇬🇧🇺🇸🇮🇹🇪🇸🇳🇱🇧🇪🇨🇭🇦🇹🇬🇷🇧🇬🇷🇴🇷🇺🇺🇦🇯🇵🇰🇷🇨🇳🇧🇷🇦🇷🇨🇦🇲🇽🇮🇳🇸🇦🇦🇪🇪🇬🇵🇹🇸🇪🇳🇴🇩🇰🇫🇮🇵🇱`) },
];

// Türkçe arama sözcükleri (emoji → sözcükler). Hepsini kapsamaz; yaygın olanlar.
const SOZ: Record<string, string> = {
  "😀": "gülümse mutlu sırıt", "😂": "kahkaha gül komik ağla", "🤣": "yerlere yat gül komik", "😍": "aşık kalp göz hayran", "🥰": "aşk sevgi kalp", "😘": "öpücük kiss", "😎": "havalı gözlük cool",
  "🤔": "düşün hmm acaba", "😢": "üzgün ağla gözyaşı", "😭": "hüngür ağla üzgün", "😡": "kızgın öfke sinir", "🥳": "parti kutla doğum günü", "😴": "uyku uyu yorgun", "🤯": "şok patla akıl",
  "😱": "korku çığlık şok", "🙄": "göz devir sıkıl", "😅": "terle gülümse gerilim", "😬": "gergin diş", "🤗": "sarıl kucak", "🤭": "hihi sır ağız", "🥺": "yalvar rica tatlı", "😇": "melek masum",
  "😈": "şeytan kötü", "💀": "kafatası ölü öldüm", "👻": "hayalet", "🤖": "robot bot", "💩": "kaka", "🤡": "palyaço", "🙈": "maymun utan göz", "😏": "sırıt kurnaz",
  "👍": "beğen tamam olur evet iyi", "👎": "beğenme olmaz hayır kötü", "👏": "alkış bravo", "🙏": "dua rica teşekkür", "🙌": "yaşasın eller havada", "🤝": "el sıkış anlaş", "💪": "güç kas kuvvet",
  "👋": "merhaba selam el salla", "✌️": "zafer barış", "🤞": "şans parmak çapraz", "👌": "tamam harika", "🤙": "ara beni", "👀": "göz bak", "🫡": "selam", "🧠": "beyin akıl",
  "❤️": "kalp aşk sevgi kırmızı", "💔": "kırık kalp üzgün", "💙": "mavi kalp", "💚": "yeşil kalp", "💛": "sarı kalp", "🖤": "siyah kalp", "💜": "mor kalp", "🔥": "ateş yangın hot",
  "✨": "parıltı yıldız", "⭐": "yıldız", "💯": "yüz tam puan", "💥": "patlama", "💤": "uyku zzz", "✅": "tamam onay doğru", "❌": "yanlış iptal hayır", "⚠️": "uyarı dikkat", "❓": "soru",
  "🐶": "köpek", "🐱": "kedi", "🐭": "fare", "🦊": "tilki", "🐻": "ayı", "🐼": "panda", "🐸": "kurbağa", "🐵": "maymun", "🐔": "tavuk", "🐧": "penguen", "🦁": "aslan", "🐯": "kaplan",
  "🐴": "at", "🦄": "unicorn tek boynuz", "🐝": "arı", "🦋": "kelebek", "🐢": "kaplumbağa", "🐍": "yılan", "🐙": "ahtapot", "🐬": "yunus", "🐳": "balina", "🦈": "köpekbalığı", "🐺": "kurt",
  "🌹": "gül çiçek", "🌻": "ayçiçeği", "🍀": "yonca şans", "🌲": "ağaç çam", "🍄": "mantar",
  "🍕": "pizza", "🍔": "hamburger", "🍟": "patates kızartma", "🌭": "sosisli", "🍗": "tavuk but", "🍣": "suşi", "🍜": "çorba noodle", "🍰": "pasta", "🎂": "doğum günü pasta", "🍫": "çikolata",
  "🍿": "patlamış mısır film", "🍩": "donut", "🍪": "kurabiye", "☕": "kahve çay", "🍵": "çay", "🍺": "bira", "🍻": "bira kadeh şerefe", "🍷": "şarap", "🥤": "içecek", "🍎": "elma", "🍌": "muz", "🍉": "karpuz", "🍓": "çilek",
  "⚽": "futbol top", "🏀": "basketbol", "🎮": "oyun gamepad", "🕹️": "oyun joystick", "🎧": "kulaklık müzik", "🎤": "mikrofon şarkı", "🎸": "gitar", "🎬": "film sinema", "🎲": "zar", "🎯": "hedef", "🏆": "kupa şampiyon", "🥇": "birinci altın madalya",
  "🎉": "kutlama parti konfeti", "🎁": "hediye", "🎈": "balon", "🧩": "yapboz puzzle", "♟️": "satranç",
  "🚗": "araba", "✈️": "uçak", "🚀": "roket", "🏠": "ev", "🌙": "ay gece", "☀️": "güneş", "☁️": "bulut", "🌧️": "yağmur", "❄️": "kar", "🌈": "gökkuşağı", "⚡": "şimşek yıldırım", "🌊": "dalga deniz",
  "📱": "telefon", "💻": "bilgisayar laptop", "⌨️": "klavye", "🖥️": "ekran bilgisayar", "📷": "kamera fotoğraf", "💡": "fikir ampul", "💰": "para", "💎": "elmas", "🔒": "kilit", "🔑": "anahtar", "🔔": "zil bildirim", "📌": "iğne sabit", "📚": "kitap", "⏰": "saat alarm",
  "🇹🇷": "türkiye bayrak", "🇦🇿": "azerbaycan bayrak", "🇩🇪": "almanya bayrak", "🏳️‍🌈": "gökkuşağı bayrak", "🚩": "bayrak kırmızı",
};

export function emojiAra(sorgu: string): string[] {
  const q = sorgu.trim().toLocaleLowerCase("tr-TR");
  if (!q) return [];
  const sonuc: string[] = [];
  for (const [e, s] of Object.entries(SOZ)) if (s.toLocaleLowerCase("tr-TR").includes(q)) sonuc.push(e);
  for (const k of KATEGORILER) if (k.ad.toLocaleLowerCase("tr-TR").includes(q)) for (const e of k.liste) if (!sonuc.includes(e)) sonuc.push(e);
  return sonuc;
}

const ANAHTAR = "cember-emoji-son";
export function sonKullanilanlar(): string[] {
  try { const v = JSON.parse(localStorage.getItem(ANAHTAR) ?? "[]"); return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, 24) : []; } catch { return []; }
}
export function sonKullanilanEkle(e: string): void {
  try { localStorage.setItem(ANAHTAR, JSON.stringify([e, ...sonKullanilanlar().filter((x) => x !== e)].slice(0, 24))); } catch { /* yoksay */ }
}
