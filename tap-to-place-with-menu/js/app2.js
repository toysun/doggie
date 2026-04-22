// ✅ 모델을 동적으로 생성·교체할 때 animation-mixer 안전 적용 패턴

/**
 * 모델 엔티티를 생성하고 animation-mixer를 안전하게 적용하는 함수.
 * model-loaded 이벤트 이후에 animation-mixer를 설정해야
 * 애니메이션 클립을 정상적으로 인식함.
 *
 * @param {string} modelId  - <a-assets>에 등록된 에셋 id (예: '#tulipModel')
 * @param {object} options  - position, rotation, scale 등 추가 속성
 * @returns {Element} 생성된 a-entity
 */
function createModelWithAnimation(modelId, options = {}) {
  const entity = document.createElement('a-entity')

  // 모델 참조 설정
  entity.setAttribute('gltf-model', modelId)

  // 위치/회전/크기 등 옵션 적용
  if (options.position) entity.setAttribute('position', options.position)
  if (options.rotation) entity.setAttribute('rotation', options.rotation)
  if (options.scale)    entity.setAttribute('scale',    options.scale)
  if (options.shadow)   entity.setAttribute('shadow',   options.shadow)

  /*
   * [핵심 수정 3] animation-mixer를 직접 선언하지 않고
   * model-loaded 이벤트 콜백 안에서 설정.
   * 모델 로드 완료 전에 animation-mixer가 초기화되면
   * 애니메이션 클립을 찾지 못해 재생이 안 됨.
   *
   * clip: '*'  → 모델 안의 모든 애니메이션 클립 재생
   * loop: repeat → 반복 재생
   */
  entity.addEventListener('model-loaded', () => {
    entity.setAttribute('animation-mixer', {
      clip: '*',
      loop: 'repeat',
      crossFadeDuration: 0.3,
    })
  })

  return entity
}


// ─── 사용 예시: 탭 이벤트로 모델 배치 ───────────────────────────────────────

AFRAME.registerComponent('selection-place-1', {
  init() {
    const scene     = this.el.sceneEl
    const container = this.el

    // 현재 선택된 모델 id (UI 메뉴에서 변경 가능)
    let selectedModel = '#tulipModel'

    // 배치된 엔티티 참조 (교체 시 제거용)
    let placedEntity = null

    scene.addEventListener('click', (e) => {
      const point = e.detail?.intersection?.point
      if (!point) return

      // 기존 모델 제거
      if (placedEntity) {
        container.removeChild(placedEntity)
        placedEntity = null
      }

      // 새 모델 생성 및 animation-mixer 적용
      placedEntity = createModelWithAnimation(selectedModel, {
        position: `${point.x} ${point.y} ${point.z}`,
        scale:    '1 1 1',
        shadow:   'cast: true; receive: true',
      })

      container.appendChild(placedEntity)
    })

    /*
     * 외부(UI 버튼 등)에서 모델을 교체할 때 호출하는 메서드.
     * 예: document.querySelector('[selection-place-1]')
     *       .components['selection-place-1'].setModel('#narcissusModel')
     */
    this.setModel = (modelId) => {
      selectedModel = modelId
    }
  },
})
