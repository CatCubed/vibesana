export interface Trigger {
  kind: 'mention' | 'emoji'
  /** What was typed after the trigger character. */
  query: string
  /** Where the trigger character sits in the text before the caret. */
  start: number
}

/**
 * Is the caret right after something that asks for suggestions? "@nam" for a mention (people, tasks,
 * projects) or ":roc" for an emoji name. Both must start a word, so e-mail addresses and times do not count.
 */
export function findTrigger(before: string): Trigger | null {
  const mention = before.match(/(?:^|\s)@([^\s@]{0,30})$/)
  if (mention) return { kind: 'mention', query: mention[1], start: before.length - mention[1].length - 1 }
  const emoji = before.match(/(?:^|[\s(]):([a-z0-9_+-]{2,30})$/)
  if (emoji) return { kind: 'emoji', query: emoji[1], start: before.length - emoji[1].length - 1 }
  return null
}

/** Moves the highlight through a list of `count` items, wrapping around at both ends. */
export function stepActive(active: number, step: 1 | -1, count: number): number {
  return count ? (active + step + count) % count : 0
}
