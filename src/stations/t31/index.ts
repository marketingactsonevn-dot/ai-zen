// scene stylesheets first, in this order (before kit.css / part2.css, as the single style.css was)
import './wells.css'
import './repo.css'
import './depth.css'
import './card.css'
import './clean.css'
import raw from '../../content/tram-31.json'
import type { StationContent } from '../../core/content'
import type { StationModule } from '../types'
import { wellsScene } from './wells'
import { cardScene } from './card'
import { repoScene3d } from './repo3d'
import { depthScene } from './depth'
import { cleanScene } from './clean'

const S = raw.scenes

const station: StationModule = {
  content: raw as unknown as StationContent,
  scenes: [
    { label: S.wells.label, mount: wellsScene },
    depthScene(),
    { label: S.card.label, mount: cardScene },
    { label: S.repo.label, mount: repoScene3d },
    cleanScene(),
  ],
}
export default station
