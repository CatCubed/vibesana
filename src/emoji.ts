/** Emoji that can be typed as :name: or picked from the toolbar. Names follow the common GitHub/Slack ones. */
export const EMOJI: Record<string, string> = {
  smile: '😄', grin: '😁', joy: '😂', sweat_smile: '😅', wink: '😉', blush: '😊', slight_smile: '🙂', upside_down: '🙃',
  heart_eyes: '😍', sunglasses: '😎', thinking: '🤔', neutral: '😐', expressionless: '😑', rolling_eyes: '🙄', smirk: '😏',
  relieved: '😌', sleeping: '😴', confused: '😕', worried: '😟', cry: '😢', sob: '😭', angry: '😠', rage: '😡',
  scream: '😱', flushed: '😳', grimacing: '😬', facepalm: '🤦', shrug: '🤷', exploding_head: '🤯', partying: '🥳',
  pleading: '🥺', nerd: '🤓', salute: '🫡', skull: '💀', ghost: '👻', robot: '🤖', clown: '🤡', poop: '💩',
  thumbsup: '👍', '+1': '👍', thumbsdown: '👎', '-1': '👎', ok_hand: '👌', clap: '👏', wave: '👋', raised_hands: '🙌',
  pray: '🙏', muscle: '💪', point_up: '☝️', point_right: '👉', point_left: '👈', point_down: '👇', handshake: '🤝',
  eyes: '👀', brain: '🧠', heart: '❤️', broken_heart: '💔', fire: '🔥', sparkles: '✨', star: '⭐', boom: '💥',
  tada: '🎉', rocket: '🚀', bulb: '💡', zap: '⚡', hundred: '💯', check: '✅', white_check_mark: '✅', x: '❌',
  warning: '⚠️', question: '❓', exclamation: '❗', no_entry: '⛔', construction: '🚧', bug: '🐛', wrench: '🔧',
  hammer: '🔨', gear: '⚙️', lock: '🔒', unlock: '🔓', key: '🔑', mag: '🔍', link: '🔗', pin: '📌', paperclip: '📎',
  memo: '📝', book: '📖', calendar: '📅', clock: '🕐', hourglass: '⏳', bell: '🔔', mute: '🔇', email: '📧',
  phone: '📞', computer: '💻', package: '📦', truck: '🚚', money: '💰', chart: '📈', chart_down: '📉', trophy: '🏆',
  coffee: '☕', beer: '🍺', pizza: '🍕', cake: '🍰', sun: '☀️', cloud: '☁️', rain: '🌧️', snowflake: '❄️', rainbow: '🌈',
  dog: '🐶', cat: '🐱', turtle: '🐢', snail: '🐌', see_no_evil: '🙈', red_circle: '🔴', green_circle: '🟢',
  yellow_circle: '🟡', blue_circle: '🔵',
}

/** The emoji for a :name:, or null. */
export function emojiFor(name: string): string | null {
  return Object.prototype.hasOwnProperty.call(EMOJI, name) ? EMOJI[name] : null
}

/** Names starting with (then containing) what was typed, best matches first, without duplicates of the same emoji. */
export function emojiMatches(query: string, limit = 8): { name: string; emoji: string }[] {
  const q = query.toLowerCase()
  const names = Object.keys(EMOJI)
  const ranked = [...names.filter((n) => n.startsWith(q)), ...names.filter((n) => !n.startsWith(q) && n.includes(q))]
  const seen = new Set<string>()
  const out: { name: string; emoji: string }[] = []
  for (const name of ranked) {
    if (seen.has(EMOJI[name])) continue
    seen.add(EMOJI[name])
    out.push({ name, emoji: EMOJI[name] })
    if (out.length === limit) break
  }
  return out
}
