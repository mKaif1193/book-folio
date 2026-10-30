// Original sample text used only to exercise the export pipelines in check scripts.
import type { Block, BookModel, Run, Section } from "../publish/model";

const PARAGRAPHS = [
  "The lighthouse keeper had not spoken to another person in eleven days, and he had begun to suspect that the gulls were keeping count. Every morning he climbed the hundred and forty steps, polished the great lens until it threw his own tired face back at him, and wrote the weather in a ledger that nobody would ever read.",
  "On the twelfth day a boat appeared on the horizon. It was small and badly painted, the kind of boat that belonged to someone who had bought it in a hurry, and it was rowing directly toward the rocks that the lighthouse had been built to warn against.",
  "He shouted, which was useless, and waved, which was worse. The rower did not look up. She was counting strokes under her breath, the way children count steps on a staircase they are afraid of, and when the hull scraped stone she simply stood, stepped onto the nearest rock, and pulled the boat after her as though it weighed nothing at all.",
  "“You’re late,” she said, when he finally reached the bottom of the path. He had no idea what she meant, and he said so. She considered this for a long moment, then reached into her coat and produced a letter, damp at the corners, addressed to him in his own handwriting.",
  "He did not remember writing it. That was the first strange thing. The second was the date at the top of the page, which was a Tuesday three weeks from now.",
  "They sat in the kitchen while the kettle muttered on the stove. She told him her name was Wren, that she had come from the mainland, and that she had been asked to deliver the letter by a man who looked very much like him, only older, and much more frightened.",
  "Outside, the fog came in the way it always did in autumn: first as a thinning of the light, then as a softness at the edges of things, and finally as a wall so complete that the lamp above them seemed to burn inside a cloud.",
  "He read the letter twice. It contained instructions, written with the urgency of someone who knew he would not be believed. Keep the lamp lit on the night of the storm. Do not trust the radio. And whatever happens, do not let her leave before the tide turns.",
];

const text = (value: string, marks: Partial<Extract<Run, { kind: "text" }>> = {}): Run => ({ kind: "text", text: value, ...marks });
const p = (value: string): Block => ({ type: "paragraph", runs: [text(value)] });

function prose(offset: number, length: number): Block[] {
  const blocks: Block[] = [];
  for (let i = 0; i < length; i++) {
    if (i > 0 && i % 7 === 0) blocks.push({ type: "scene-break" });
    blocks.push(p(PARAGRAPHS[(offset + i) % PARAGRAPHS.length]));
  }
  return blocks;
}

let chapterNumber = 0;
const chapter = (title: string, blocks: Block[]): Section => ({
  id: `ch-${title}`,
  area: "body",
  kind: "chapter",
  title,
  number: ++chapterNumber,
  blocks,
});

export const SAMPLE_BOOK: BookModel = {
  id: "00000000-0000-4000-8000-000000000001",
  title: "The Keeper of Small Hours",
  subtitle: "A Novel",
  author: "A. N. Author",
  language: "en",
  sections: [
    { id: "dedication", area: "front", kind: "dedication", title: "Dedication", number: null, blocks: [p("For everyone who kept a light on.")] },
    { id: "part-1", area: "body", kind: "part", title: "Part One: The Letter", number: null, blocks: [] },
    chapter("The Twelfth Day", [
      ...prose(0, 9),
      { type: "heading", level: 2, runs: [text("The Ledger")] },
      { type: "paragraph", runs: [text("Some entries were written in "), text("italics", { italic: true }), text(", others in "), text("bold capitals", { bold: true }), text(".")] },
      { type: "quote", blocks: [p("Keep the lamp lit on the night of the storm.")] },
      { type: "list", ordered: true, items: [[p("Polish the lens.")], [p("Record the weather.")], [p("Count the gulls.")]] },
      ...prose(4, 6),
    ]),
    chapter("A Letter Not Yet Written", prose(3, 11)),
    chapter("Fog", prose(6, 19)),
    chapter("The Tide Turns", prose(1, 9)),
    { id: "ack", area: "back", kind: "acknowledgments", title: "Acknowledgments", number: null, blocks: [p("Thanks to the keepers, past and present.")] },
  ],
};
