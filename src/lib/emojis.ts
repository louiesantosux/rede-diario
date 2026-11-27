// Emojis oferecidos no seletor, por categoria. Lista curada (sem dependências).

export type EmojiCategory = { id: string; label: string; icon: string; list: string[] };

const split = (s: string) => s.trim().split(/\s+/);

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    id: 'rostos',
    label: 'Rostos',
    icon: '😊',
    list: split(`
      😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 😉 😊 😇 🥰 😍 🤩 😘 😗 ☺️ 😚 😙 🥲 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🫢 🫣 🤫 🤔 🫡
      🤐 🤨 😐 😑 😶 🫥 😏 😒 🙄 😬 😮‍💨 🤥 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🥵 🥶 🥴 😵 🤯 🤠 🥳 🥸 😎 🤓 🧐
      😕 🫤 😟 🙁 ☹️ 😮 😯 😲 😳 🥺 🥹 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿
      💀 👻 👽 🤖 🎃 😺 😸 😹 😻 😼 😽 🙀 😿 😾`),
  },
  {
    id: 'gestos',
    label: 'Gestos e pessoas',
    icon: '👋',
    list: split(`
      👋 🤚 🖐️ ✋ 🖖 🫶 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 👐 🤲 🤝 🙏 ✍️
      💅 🤳 💪 🦋 👀 👁️ 👅 👄 🫦 🧠 🫀 👶 🧒 👦 👧 🧑 👱 👨 👩 🧓 👴 👵 🙋 🙆 🙅 🤷 🤦 🙇 💁 🧑‍💻 🧑‍🎨 🧑‍🎤
      🧑‍🍳 🧑‍🚀 🧚 🧜 🧝 🧙 💃 🕺 👯 🧘 🛀 🛌 👫 👭 👬 💏 💑`),
  },
  {
    id: 'coracoes',
    label: 'Corações e brilhos',
    icon: '💖',
    list: split(`
      ❤️ 🩷 🧡 💛 💚 💙 🩵 💜 🤎 🖤 🩶 🤍 💔 ❤️‍🔥 ❤️‍🩹 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ♥️ ♡ ✨ ⭐ 🌟 💫 ⚡ 🔥 💥
      🌈 ☁️ 🫧 🎀 🪩 💌 💋 ✦ ✧ ★ ☆ ✩ ✪ ❀ ✿ ❁ ☾ ☽ ♪ ♫ ♬ ˚ ʚ ɞ`),
  },
  {
    id: 'natureza',
    label: 'Natureza e animais',
    icon: '🌸',
    list: split(`
      🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐻‍❄️ 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🦇 🐺 🐴 🦄 🐝 🐛 🦋 🐌
      🐞 🐢 🐍 🦎 🐙 🦑 🦐 🐠 🐟 🐬 🐳 🐋 🦈 🦭 🐊 🐘 🦒 🦔 🐾 🐉 🌵 🎄 🌲 🌳 🌴 🪴 🌱 🌿 ☘️ 🍀 🍃 🍂 🍁
      🍄 🐚 🪸 🌾 💐 🌷 🌹 🥀 🌺 🌸 🌼 🌻 🌞 🌝 🌛 🌜 🌚 🌕 🌙 🌎 🪐 ☄️ 🌤️ ⛅ 🌧️ ⛈️ 🌩️ ❄️ ☃️ ⛄ 🌬️ 💨 💧 🌊`),
  },
  {
    id: 'comida',
    label: 'Comida e bebida',
    icon: '🍓',
    list: split(`
      🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🥑 🥦 🥕 🌽 🌶️ 🥔 🥐 🍞 🧀 🥚 🍳 🥞 🧇 🥓 🍔 🍟
      🍕 🌭 🥪 🌮 🌯 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🍤 🍙 🍚 🍘 🍡 🍧 🍨 🍦 🥧 🧁 🍰 🎂 🍮 🍭 🍬 🍫 🍿 🍩 🍪 🥛 ☕
      🍵 🧋 🥤 🧃 🍶 🍺 🍷 🥂 🍹 🧉`),
  },
  {
    id: 'atividades',
    label: 'Atividades',
    icon: '🎮',
    list: split(`
      ⚽ 🏀 🏈 ⚾ 🎾 🏐 🏓 🏸 🥊 🛹 ⛸️ 🎿 🏂 🏄 🏊 🚴 🧗 🤸 🏆 🥇 🎖️ 🎫 🎟️ 🎪 🎭 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎷
      🎺 🎸 🪕 🎻 🎲 ♟️ 🎯 🎳 🎮 🕹️ 🧩 🧸 🪀 🪁 🎰 📸 📷 🎞️ 📺 📻 💿 📀 💾 📼`),
  },
  {
    id: 'viagem',
    label: 'Lugares e viagem',
    icon: '✈️',
    list: split(`
      🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🛻 🚚 🛵 🏍️ 🚲 🛴 🚂 🚆 🚇 🚊 ✈️ 🛫 🛬 🚀 🛸 🚁 ⛵ 🚤 🛳️ ⚓ 🗺️ 🧭 🏔️ ⛰️
      🌋 🏕️ 🏖️ 🏜️ 🏝️ 🏞️ 🏟️ 🏛️ 🏠 🏡 🏢 🏰 🏯 🗼 🗽 ⛪ 🕌 ⛩️ ⛲ ⛺ 🌁 🌃 🏙️ 🌄 🌅 🌆 🌇 🌉 🎠 🎡 🎢 💈`),
  },
  {
    id: 'objetos',
    label: 'Objetos',
    icon: '💡',
    list: split(`
      ⌚ 📱 💻 ⌨️ 🖥️ 🖨️ 🖱️ 💽 📞 ☎️ 📟 📠 🔋 🔌 💡 🔦 🕯️ 🪔 🧯 💸 💵 💰 💳 💎 ⚖️ 🔧 🔨 🛠️ 🔩 ⚙️ 🧲 🔮 🧿 🪬
      💊 🩹 🧸 🪞 🪟 🛏️ 🛋️ 🪑 🚪 🛁 🧴 🧼 🪥 🧽 🛒 🎁 🎈 🎏 🎐 🧧 ✉️ 📩 📨 📦 📫 📝 📒 📓 📔 📕 📗 📘 📙
      📚 📖 🔖 🧷 📎 🖇️ 📐 📏 📌 📍 ✂️ 🖊️ 🖋️ ✒️ 🖌️ 🖍️ ✏️ 🔍 🔒 🔓 🗝️ 🔑 👓 🕶️ 🥽 👔 👕 👖 🧣 🧤 🧥 🧦
      👗 👘 👙 👚 👛 👜 👝 🎒 👞 👟 🥾 👠 👡 👢 👑 👒 🎩 🧢 💍 💄 ⏰ ⏳ ⌛ 🕰️ 🗓️ 📅 📆`),
  },
  {
    id: 'simbolos',
    label: 'Símbolos',
    icon: '♾️',
    list: split(`
      ☮️ ✝️ ☪️ 🕉️ ☯️ ✡️ ☸️ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ ⛎ ⚛️ ♾️ ✔️ ✅ ☑️ ❌ ❎ ➕ ➖ ➗ ✖️ ‼️ ⁉️ ❓ ❔ ❕ ❗
      〰️ ➰ ➿ ♻️ ⚜️ 🔱 📛 🔰 ⭕ 💯 🔞 📵 🚫 ⚠️ 🔆 🔅 💤 💬 💭 🗯️ 🔔 🔕 🎵 🎶 ➡️ ⬅️ ⬆️ ⬇️ ↗️ ↘️ ↙️ ↖️ ↕️ ↔️ 🔄
      🔃 🔀 🔁 🔂 ▶️ ⏸️ ⏹️ ⏺️ ⏭️ ⏮️ 🔼 🔽 🆗 🆕 🆒 🆓 🆙 🔴 🟠 🟡 🟢 🔵 🟣 🟤 ⚫ ⚪ 🟥 🟧 🟨 🟩 🟦 🟪 🟫 ⬛ ⬜
      🔶 🔷 🔸 🔹 🔺 🔻 💠 🔘 🏳️ 🏴 🏁 🚩 🏳️‍🌈 🏳️‍⚧️ 🇧🇷`),
  },
];

export const EMOJI_RECENT_KEY = 'recent-emojis';
