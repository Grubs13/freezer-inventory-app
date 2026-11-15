import { describe, expect, it } from 'vitest';
import type { InventoryItem } from './domain';
import { guessCategory, parseCommand } from './parse';

const today = '2026-11-14';
const item = (id: string, name: string, quantity: number, extra: Partial<InventoryItem> = {}): InventoryItem => ({
  id, freezerId: 'f1', name, category: 'other', unit: 'pack',
  lots: quantity > 0 ? [{ id: `${id}-1`, quantity, frozenOn: '2026-10-01', bestBy: null, source: 'manual' }] : [],
  ...extra,
});
const stock: InventoryItem[] = [
  item('turkey', 'Ground turkey', 3, { category: 'poultry' }),
  item('pork', 'Ground pork', 1, { category: 'meat' }),
  item('thighs', 'Chicken thighs', 2, {
    category: 'poultry',
    lots: [
      { id: 'thighs-oct', quantity: 1, frozenOn: '2026-10-02', bestBy: null, source: 'manual' },
      { id: 'thighs-nov', quantity: 1, frozenOn: '2026-11-08', bestBy: null, source: 'voice' },
    ],
  }),
  item('breasts', 'Chicken breasts', 4, { category: 'poultry' }),
  item('pizza', 'Frozen pizza', 5, { category: 'frozen_meals', unit: 'item' }),
  item('mac', 'Mac and cheese', 2, { category: 'frozen_meals', unit: 'box' }),
  item('gone', 'Peas', 0, { category: 'vegetables', unit: 'bag' }),
];
const parse = (text: string) => parseCommand(text, stock, today);

describe('adding food', () => {
  it('reads a pack of something new and guesses its category', () => {
    expect(parse('Add a pack of ground beef').drafts).toEqual([
      { kind: 'add', name: 'Ground beef', quantity: 1, unit: 'pack', category: 'meat', frozenOn: today },
    ]);
  });

  it('splits several items in one sentence and keeps the verb going', () => {
    const { drafts, unparsed } = parse('add two packs of chicken thighs, three frozen pizzas and a bag of peas to the freezer');
    expect(unparsed).toEqual([]);
    expect(drafts).toEqual([
      { kind: 'add', name: 'Chicken thighs', quantity: 2, unit: 'pack', category: 'poultry', frozenOn: today },
      { kind: 'add', name: 'Frozen pizza', quantity: 3, unit: 'item', category: 'frozen_meals', frozenOn: today },
      { kind: 'add', name: 'Peas', quantity: 1, unit: 'bag', category: 'vegetables', frozenOn: today },
    ]);
  });

  it('accepts weights and fractions', () => {
    expect(parse('put 2.5 pounds of venison in the deep freeze').drafts[0]).toMatchObject({ name: 'Venison', quantity: 2.5, unit: 'lb', category: 'meat' });
    expect(parse('add one and a half pounds of salmon').drafts[0]).toMatchObject({ quantity: 1.5, unit: 'lb', category: 'seafood' });
    expect(parse('add half a pack of bacon').drafts[0]).toMatchObject({ quantity: 0.5, unit: 'pack' });
  });

  it('understands loose amounts', () => {
    expect(parse('we got a couple of tubs of ice cream').drafts[0]).toMatchObject({ quantity: 2, unit: 'container', category: 'desserts' });
    expect(parse('added a few bags of corn').drafts[0]).toMatchObject({ quantity: 3, unit: 'bag', category: 'vegetables' });
  });

  it('keeps names that contain "and"', () => {
    expect(parse('add 2 boxes of mac and cheese').drafts).toEqual([
      { kind: 'add', name: 'Mac and cheese', quantity: 2, unit: 'box', category: 'frozen_meals', frozenOn: today },
    ]);
  });

  it('defaults to a plain count when no unit is said', () => {
    expect(parse('add a lasagna').drafts[0]).toMatchObject({ name: 'Lasagna', quantity: 1, unit: 'item', category: 'frozen_meals' });
  });
});

describe('removing food', () => {
  it('matches what is in the freezer', () => {
    expect(parse('took out a pack of ground turkey').drafts).toEqual([
      { kind: 'remove', heard: 'ground turkey', itemId: 'turkey', lotId: null, quantity: 1, choices: [] },
    ]);
  });

  it('handles plural and singular differences and "out" at the end', () => {
    expect(parse('I took two pizzas out').drafts[0]).toMatchObject({ itemId: 'pizza', quantity: 2 });
    expect(parse('we ate the chicken thigh').drafts[0]).toMatchObject({ itemId: 'thighs', quantity: 1 });
  });

  it('offers the choices when a vague name fits more than one item', () => {
    const draft = parse('used a pack of chicken').drafts[0];
    expect(draft).toMatchObject({ kind: 'remove' });
    expect(draft.kind === 'remove' && [...draft.choices].sort()).toEqual(['breasts', 'thighs']);
  });

  it('takes from the pack added in the month that was named', () => {
    expect(parse('remove the chicken from november').drafts[0]).toMatchObject({ itemId: 'thighs', lotId: 'thighs-nov', quantity: 1, choices: [] });
    expect(parse('used a pack of chicken thighs from oct 2').drafts[0]).toMatchObject({ itemId: 'thighs', lotId: 'thighs-oct' });
  });

  it('removes everything for "the last of"', () => {
    expect(parse('finished the last of the frozen pizza').drafts[0]).toMatchObject({ itemId: 'pizza', quantity: 5 });
  });

  it('never removes more than is there', () => {
    expect(parse('took out 4 packs of ground pork').drafts[0]).toMatchObject({ itemId: 'pork', quantity: 1 });
  });

  it('does not match items that have run out', () => {
    expect(parse('took out a bag of peas').drafts[0]).toMatchObject({ itemId: null });
  });
});

describe('mixed commands', () => {
  it('handles adding and removing in one go', () => {
    const { drafts } = parse('add three packs of ground pork and take out a frozen pizza');
    expect(drafts.map((d) => d.kind)).toEqual(['add', 'remove']);
    expect(drafts[0]).toMatchObject({ name: 'Ground pork', quantity: 3, category: 'meat' });
    expect(drafts[1]).toMatchObject({ itemId: 'pizza', quantity: 1 });
  });

  it('answers questions without changing anything', () => {
    const result = parse('How much chicken do we have?');
    expect(result.drafts).toEqual([]);
    expect([...(result.question?.itemIds ?? [])].sort()).toEqual(['breasts', 'thighs']);
    expect(parse('do we have any pizza').question?.itemIds).toEqual(['pizza']);
  });

  it('reports parts it could not understand', () => {
    expect(parse('hello there').unparsed).toEqual(['hello there']);
  });
});

describe('category guesses', () => {
  it.each([
    ['chicken nuggets', 'frozen_meals'],
    ['pork chops', 'meat'],
    ['peaches', 'fruit'],
    ['blueberries', 'fruit'],
    ['tater tots', 'frozen_meals'],
    ['dinner rolls', 'baked_goods'],
    ['shrimp', 'seafood'],
    ['mystery container', 'other'],
  ])('%s is %s', (name, category) => {
    expect(guessCategory(name)).toBe(category);
  });
});
