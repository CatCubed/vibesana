/** Asana's system story text starts with the author's name; drop it when the name is shown separately. */
export function withoutAuthor(text: string, author: string | null | undefined): string {
  if (!author) return text
  return text.startsWith(`${author} `) ? text.slice(author.length + 1) : text
}
