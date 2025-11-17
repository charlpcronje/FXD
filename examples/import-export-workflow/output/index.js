import { greet } from './greet.js';

/* FX:BEGIN id=project.src.index.header lang=js file=src/index.js checksum=27c05e8e order=0 version=1 */
/* FX:END id=project.src.index.header */

/* FX:BEGIN id=project.src.index.main lang=js file=src/index.js checksum=7f61f977 order=1 version=1 */
const name = process.argv[2] || 'World';
console.log(greet(name));
/* FX:END id=project.src.index.main */