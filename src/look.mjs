// The parts and colours a person's look can have (the same list as public/look.js; test/look.test.mjs checks they match),
// and the check a look must pass before it is kept.

export const LOOK_OPTIONS = {
  gender: [
    { id: 'woman', name: 'Woman' },
    { id: 'man', name: 'Man' },
    { id: 'nonbinary', name: 'Non-binary' },
  ],
  skin: [
    { id: 'very-light', name: 'Very light', colour: '#fbe0cc' },
    { id: 'light', name: 'Light', colour: '#f4c596' },
    { id: 'medium', name: 'Medium', colour: '#dfa577' },
    { id: 'tan', name: 'Tan', colour: '#c18456' },
    { id: 'brown', name: 'Brown', colour: '#94603c' },
    { id: 'dark', name: 'Dark brown', colour: '#62402a' },
  ],
  hair: [
    { id: 'short', name: 'Short' },
    { id: 'buzz', name: 'Buzz cut' },
    { id: 'side-part', name: 'Side part' },
    { id: 'curly', name: 'Curly' },
    { id: 'afro', name: 'Afro' },
    { id: 'bob', name: 'Bob' },
    { id: 'long', name: 'Long' },
    { id: 'ponytail', name: 'Ponytail' },
    { id: 'bun', name: 'Bun' },
    { id: 'bald', name: 'Bald' },
  ],
  hairColour: [
    { id: 'black', name: 'Black', colour: '#27272f' },
    { id: 'dark-brown', name: 'Dark brown', colour: '#4a3226' },
    { id: 'brown', name: 'Brown', colour: '#7a5236' },
    { id: 'auburn', name: 'Auburn', colour: '#93402c' },
    { id: 'ginger', name: 'Ginger', colour: '#d0703a' },
    { id: 'blonde', name: 'Blonde', colour: '#e3c26e' },
    { id: 'grey', name: 'Grey', colour: '#a3a6ad' },
    { id: 'white', name: 'White', colour: '#ecebe6' },
    { id: 'blue', name: 'Blue', colour: '#4f84d6' },
    { id: 'pink', name: 'Pink', colour: '#e58bb6' },
  ],
  top: [
    { id: 'sky', name: 'Sky blue', colour: '#69bfe9' },
    { id: 'lilac', name: 'Lilac', colour: '#b29be4' },
    { id: 'mint', name: 'Mint', colour: '#78c6a3' },
    { id: 'coral', name: 'Coral', colour: '#ef8a91' },
    { id: 'mustard', name: 'Mustard', colour: '#efbd72' },
    { id: 'steel', name: 'Steel blue', colour: '#74a7d0' },
    { id: 'charcoal', name: 'Charcoal', colour: '#4b5566' },
    { id: 'cream', name: 'Cream', colour: '#f3ead8' },
  ],
  glasses: [
    { id: 'none', name: 'None' },
    { id: 'square', name: 'Glasses' },
    { id: 'round', name: 'Round glasses' },
    { id: 'sun', name: 'Sunglasses' },
  ],
  facial: [
    { id: 'none', name: 'None' },
    { id: 'stubble', name: 'Stubble' },
    { id: 'beard', name: 'Beard' },
    { id: 'moustache', name: 'Moustache' },
  ],
  headwear: [
    { id: 'none', name: 'None' },
    { id: 'beret', name: 'Beret' },
    { id: 'cap', name: 'Cap' },
    { id: 'beanie', name: 'Beanie' },
    { id: 'headphones', name: 'Headphones' },
    { id: 'bow', name: 'Bow' },
  ],
};

/**
 * A look as sent by the page, kept only when every part is one of the ids above; otherwise null (never half a look).
 */
export function cleanLook(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};
  for (const [k, list] of Object.entries(LOOK_OPTIONS)) {
    const v = raw[k];
    if (!list.some((o) => o.id === v)) return null;
    out[k] = v;
  }
  return out;
}
