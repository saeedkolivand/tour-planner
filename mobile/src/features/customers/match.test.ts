/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Stop } from '../tour/types.ts';
import { type Customer, findCustomer, isVisitTo } from './match.ts';

const c = (name: string, street: string, number: string, postcode: string): Customer => ({ name, street, number, postcode, note: '', photos: [] });
const s = (name: string, street: string, number: string, postcode: string): Stop => ({ name, street, number, postcode, type: 'business', parcels: 1 });
const rathaus = c('Rathaus-Apotheke', 'Hohe Str.', '68', '50667');

test('the same pharmacy read again finds it, through OCR slips', () => {
  assert.ok(isVisitTo(rathaus, s('Rathaus-Apotheke', 'Hohe Straße', '68', '50667')), 'Str. / Straße');
  assert.ok(isVisitTo(rathaus, s('Rathaus-Apothcke', 'Hohe Str.', '68', '50667')), 'a misread letter in the name');
  assert.ok(isVisitTo(rathaus, s('Rathaus-Apotheke', 'Hohe Str.', '68', '50687')), 'a postcode digit off');
  assert.ok(isVisitTo(rathaus, s('Rathaus-Apotheke', 'Hoha Sir', '6B', '50667')), 'the exact name, the street mangled');
  assert.ok(isVisitTo(rathaus, s('', 'Hohe Str.', '68', '50667')), 'no name: the address');
});

test('a different place does not', () => {
  assert.ok(!isVisitTo(rathaus, s('Rathaus-Apotheke', 'Hohe Str.', '68', '51103')), 'another postcode');
  assert.ok(!isVisitTo(rathaus, s('Dom-Apotheke', 'Hohe Str.', '12', '50667')), 'another name, another house');
  const linden = c('Linden-Apotheke', 'Dürener Str.', '5', '50931');
  assert.ok(!isVisitTo(linden, s('Lindner-Apotheke', 'Aachener Str.', '200', '50931')), 'a letter apart, another street');
});

test('findCustomer returns the id', () => {
  assert.equal(findCustomer({ a: c('Dom-Apotheke', 'Domkloster', '2', '50667'), b: rathaus }, s('Rathaus-Apotheke', 'Hohe Str.', '68', '50667')), 'b');
  assert.equal(findCustomer({ b: rathaus }, s('Bären-Apotheke', 'Severinstr.', '1', '50678')), undefined);
});
