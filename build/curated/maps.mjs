// Landfall — the maps, and the frame each one is drawn in.
//
// `box` is [lonMin, latMin, lonMax, latMax] and does two jobs: it crops context
// coastlines to something that will render, and it keeps a country's distant
// possessions from stretching its map across an ocean. France drawn to include
// Réunion is not a map of France.
//
// `shift` adds 360° to negative longitudes before anything else happens, which
// is the only sane way to draw Russia or the Pacific: both straddle the
// antimeridian, and without it the geometry tears across the whole frame.
//
// No composite projections. The United States is drawn where it actually is —
// Alaska at its real size and position rather than shrunk into a box off
// California. Locate questions zoom to the candidates, so nothing is too small
// to tap, and the honest map is the one worth learning.

import { equalEarth } from '../lib/geo.mjs';

const inPack = (pid, kinds) => (items) => [...items.values()]
  .filter((it) => it.pk.includes(pid) && (!kinds || kinds.includes(it.k)))
  .map((it) => it.i);

const region = (...regions) => (items) => [...items.values()]
  .filter((it) => (it.k === 'country' || it.k === 'territory') && regions.includes(it.x.r))
  .map((it) => it.i);

export const MAPS = {
  world: {
    width: 1150, tol: 0.5, minArea: 0.22, context: false,
    projection: () => ({ kind: 'equalEarth', fn: equalEarth() }),
    box: [-180, -60, 180, 84],
    members: (items) => [...items.values()].filter((it) => it.k === 'country' || it.k === 'territory').map((it) => it.i),
  },

  caribbean: {
    width: 860, tol: 0.25, minArea: 0.05, round: 1, box: [-88, 8.5, -57, 28],
    members: inPack('caribbean'),
  },

  africa: { width: 860, box: [-26, -36, 52, 38], members: region('Africa') },
  europe: { width: 860, box: [-26, 34, 46, 72], members: region('Europe') },
  asia: { width: 950, box: [25, -12, 152, 58], members: region('Asia') },
  'south-america': { width: 860, box: [-82, -56, -33, 13], members: region('Americas') },
  'central-america': { width: 950, box: [-119, 5, -76, 33], members: region('Americas') },
  'middle-east': { width: 950, box: [24, 11, 65, 43], members: region('Asia', 'Africa') },
  oceania: { width: 950, shift: true, box: [110, -50, 230, 25], members: region('Oceania') },

  canada: { width: 860, box: [-142, 41, -51, 84], members: inPack('canada') },
  usa: { width: 950, box: [-172, 17, -64, 72], members: inPack('usa') },
  china: { width: 860, box: [72, 16, 137, 54], members: inPack('china') },
  mexico: { width: 950, box: [-119, 13, -85, 33], members: inPack('mexico') },
  brazil: { width: 860, box: [-75, -34, -33, 6], members: inPack('brazil') },
  india: { width: 860, box: [67, 5, 98, 37], members: inPack('india') },
  japan: { width: 860, box: [122, 23, 149, 46], members: inPack('japan') },
  australia: { width: 950, box: [111, -44, 155, -9], members: inPack('australia') },
  germany: { width: 780, box: [5, 46, 16, 56], members: inPack('germany') },
  russia: { width: 1150, shift: true, box: [19, 40, 191, 82], members: inPack('russia') },
  argentina: { width: 620, box: [-74, -56, -52, -21], members: inPack('argentina') },
  nigeria: { width: 780, box: [2, 3, 15, 14], members: inPack('nigeria') },
  'south-africa': { width: 860, box: [15, -36, 34, -21], members: inPack('south-africa') },
  indonesia: { width: 950, box: [94, -12, 142, 7], members: inPack('indonesia') },
  switzerland: { width: 780, box: [5, 45, 11, 48], members: inPack('switzerland') },
  netherlands: { width: 620, box: [3, 50, 8, 54], members: inPack('netherlands') },
  ethiopia: { width: 780, box: [32, 3, 48, 15], members: inPack('ethiopia') },
  egypt: { width: 780, box: [24, 21, 37, 32], members: inPack('egypt') },
  kenya: { width: 780, box: [33, -5, 42, 6], members: inPack('kenya') },
  pakistan: { width: 780, box: [60, 23, 78, 38], members: inPack('pakistan') },
  vietnam: { width: 620, box: [101, 8, 110, 24], members: inPack('vietnam') },
  philippines: { width: 780, box: [116, 4, 127, 21], members: inPack('philippines') },
  colombia: { width: 780, box: [-80, -5, -66, 13], members: inPack('colombia') },
  chile: { width: 620, box: [-76, -56, -66, -17], members: inPack('chile') },
  peru: { width: 780, box: [-82, -19, -68, 0], members: inPack('peru') },
  poland: { width: 780, box: [13, 48, 25, 55], members: inPack('poland') },
  turkey: { width: 950, box: [25, 35, 45, 43], members: inPack('turkey') },
  'south-korea': { width: 780, box: [125, 33, 130, 39], members: inPack('south-korea') },
  'new-zealand': { width: 780, box: [166, -48, 179, -34], members: inPack('new-zealand') },
  'saudi-arabia': { width: 860, box: [34, 15, 56, 33], members: inPack('saudi-arabia') },
  italy: { width: 780, box: [6, 35, 19, 47], members: inPack('italy') },
  spain: { width: 950, box: [-19, 27, 5, 44], members: inPack('spain') },
  france: { width: 780, box: [-6, 41, 10, 52], members: inPack('france') },
  uk: { width: 780, box: [-9, 49, 2, 61], members: inPack('uk') },
};
