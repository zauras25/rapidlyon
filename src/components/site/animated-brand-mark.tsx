import { useId } from 'react';

/**
 * Shared RapidlyOn logo. The orbiting satellites move a full 360 degrees,
 * while the outline, center disk, and R letter remain stationary.
 * Inline SVG ensures reduced-motion support and consistent rendering.
 */
export function AnimatedBrandMark() {
  const gradientId = useId().replace(/:/g, '');

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="100 -365 5028 5028"
      width="44"
      height="44"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} gradientUnits="userSpaceOnUse" x1="1364.02" y1="2151.54" x2="3864.02" y2="2151.54">
          <stop offset="0" stopColor="#45641F" />
          <stop offset="1" stopColor="#BCE25A" />
        </linearGradient>
      </defs>
      <path d={"M2614 422c955,0 1729,775 1729,1730 0,955 -774,1729 -1729,1729 -955,0 -1729,-774 -1729,-1729 0,-955 774,-1730 1729,-1730z"} fill="none" stroke="#ACFC08" strokeWidth={41.6654} strokeLinecap="round" strokeLinejoin="round" />
      <path d={"M2614 902c690,0 1250,559 1250,1250 0,690 -560,1250 -1250,1250 -690,0 -1250,-560 -1250,-1250 0,-691 560,-1250 1250,-1250z"} fill={`url(#${gradientId})`} />
      <path d={"M2208 1754c215,-56 583,-85 804,-21 512,149 33,636 -688,660 15,-167 181,-533 -109,-489 -45,71 -103,325 -117,437 -74,4 -101,7 -129,58 8,80 32,83 101,110 3,110 -46,342 35,416 88,27 106,-57 129,-126 24,-73 40,-150 56,-227 126,24 236,59 349,101 191,70 642,307 785,316 115,7 251,-44 185,-151 -36,-37 -150,-56 -216,-79 -73,-25 -621,-214 -673,-252l41 -19c95,-38 139,-42 259,-103 118,-61 272,-183 333,-297 96,-178 86,-337 -70,-456 -293,-223 -1136,-155 -1379,12 0,0 0,0 -1,0 -55,93 -98,195 -125,303 77,-71 352,-173 430,-193z"} fill="#FEFEFE" />
      <g className="rapidlyon-orbit-dots">
        <path d={"M1549 3157c317,0 575,257 575,575 0,317 -258,575 -575,575 -318,0 -575,-258 -575,-575 0,-318 257,-575 575,-575z"} fill="#ABC2A2" />
        <path d={"M4090 694c206,0 374,167 374,374 0,206 -168,374 -374,374 -207,0 -374,-168 -374,-374 0,-207 167,-374 374,-374z"} fill="#86C20F" />
      </g>
    </svg>
  );
}
