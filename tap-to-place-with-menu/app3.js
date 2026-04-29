import {selectionPlaceComponent} from './js/selection-place-1.js'
AFRAME.registerComponent('selection-place-1', selectionPlaceComponent)

import {changeColorComponent, absPinchScaleComponent, annotationComponent, proximityComponent, gltfMorphComponent} from './js/components.js'
AFRAME.registerComponent('change-color', changeColorComponent)
AFRAME.registerComponent('annotation', annotationComponent)
AFRAME.registerComponent('absolute-pinch-scale', absPinchScaleComponent)
AFRAME.registerComponent('proximity', proximityComponent)
AFRAME.registerComponent('gltf-morph', gltfMorphComponent)