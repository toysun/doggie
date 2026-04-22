const selectionPlaceComponent = {
  init() {
    const container = document.getElementById('container')
    const ground    = document.getElementById('ground')
    const scene     = document.querySelector('a-scene')

    const entries = [
      {id: '#narcissusModel', img: './assets/icons/narcissus.jpg'},
      {id: '#tulipModel',     img: './assets/icons/tulip.jpg'},
      {id: '#margaritaModel', img: './assets/icons/chineserose.jpg'},
      {id: 'eraser',          img: './assets/icons/eraser.jpg'},
    ]

    // [수정 4] 초기값을 null → 0 으로 설정하여 최초 클릭 시 TypeError 방지
    let currentEntry    = 0
    let focusedButton   = null
    let isErasing       = false
    let canCreateObject = true

    function setEntry(index, button) {
      currentEntry = index
      isErasing    = entries[index].id === 'eraser'
      if (focusedButton) focusedButton.classList.remove('focused')
      focusedButton = button
      focusedButton.classList.add('focused')
    }

    // 버튼 생성
    entries.forEach((entry, index) => {
      const btn = document.createElement('button')
      btn.classList.add('carousel')
      btn.style.backgroundImage = `url(${entry.img})`
      btn.addEventListener('click', (event) => {
        event.preventDefault()
        setEntry(index, btn)
      })
      container.appendChild(btn)

      // [수정 4] 첫 번째 버튼을 초기 선택 상태로 표시
      if (index === 0) {
        focusedButton = btn
        btn.classList.add('focused')
      }
    })

    if (entries.length >= 5) {
      container.style.pointerEvents = 'auto'
    }

    document.addEventListener('click', (event) => {
      if (!event.target.closest('.carousel')) {
        if (focusedButton) {
          event.preventDefault()
          focusedButton.focus()
        }
      }
    })

    scene.addEventListener('click', (event) => {
      if (!canCreateObject) return

      const {intersectedEl, intersection} = event.detail

      if (isErasing) {
        // ── 지우개 모드 ──────────────────────────────────────────────────────
        if (
          intersectedEl &&
          intersectedEl !== ground &&
          intersectedEl.classList.contains('cantap')
        ) {
          intersectedEl.setAttribute('animation', {
            property: 'scale',
            to:       '0.0001 0.0001 0.0001',
            easing:   'easeInQuad',
            dur:      300,
          })

          /*
           * [수정 5] setTimeout을 애니메이션 dur(300ms)보다 50ms 길게 설정.
           *          렌더링 프레임 타이밍에 따라 제거가 애니메이션보다 먼저
           *          실행되는 경우를 방지.
           */
          setTimeout(() => {
            if (intersectedEl.parentNode) {
              intersectedEl.parentNode.removeChild(intersectedEl)
            }
          }, 350)
        }

      } else if (entries[currentEntry] && entries[currentEntry].id !== 'eraser') {
        // ── 오브젝트 배치 모드 ───────────────────────────────────────────────
        if (!intersection?.point) return

        const newEl = document.createElement('a-entity')
        newEl.setAttribute('position', intersection.point)
        newEl.setAttribute('gltf-model', entries[currentEntry].id)
        newEl.setAttribute('visible', 'false')
        newEl.setAttribute('scale',   '0.0001 0.0001 0.0001')
        newEl.setAttribute('shadow',  {receive: false})
        newEl.classList.add('cantap')

        scene.appendChild(newEl)

        newEl.addEventListener('model-loaded', () => {
          // 모델 로드 완료 후 등장 애니메이션 시작
          newEl.setAttribute('visible', 'true')
          newEl.setAttribute('animation', {
            property: 'scale',
            to:       '1 1 1',
            easing:   'easeOutElastic',
            dur:      800,
          })

          /*
           * [수정 1, 2] animation-mixer를 model-loaded 안에서 설정하되,
           *             등장 scale 애니메이션(dur: 800ms)이 완전히 끝난 뒤에
           *             animation-mixer를 활성화하여 두 애니메이션의 충돌 방지.
           *
           *             animationcomplete 이벤트를 사용해 정확한 완료 시점을 감지.
           *             clip: '*'  → 모델 내 모든 애니메이션 클립 재생
           *             loop: repeat → 반복 재생
           *             crossFadeDuration → 클립 전환 시 자연스러운 블렌딩
           */
          newEl.addEventListener('animationcomplete', () => {
            newEl.setAttribute('animation-mixer', {
              clip:              '*',
              loop:              'repeat',
              crossFadeDuration: 0.3,
            })
          }, {once: true})  // 등장 애니메이션 1회만 감지 후 리스너 자동 제거
        })

        console.log('Made one:', entries[currentEntry].id)

        // 200ms 쿨다운 — 연속 배치 방지
        canCreateObject = false
        setTimeout(() => { canCreateObject = true }, 200)
      }
    })

    /*
     * [수정 3] raycaster 업데이트 방식 수정.
     *          기존: camera.setAttribute('raycaster', 'objects', `${raycaster.objects}, .cantap`)
     *          → A-Frame에서 setAttribute 3번째 인자 방식은 일부 버전에서 동작하지 않음.
     *          수정: getAttribute로 현재 객체를 가져온 뒤 objects 키만 교체하여 재설정.
     */
    const camera = document.querySelector('a-camera')
    if (camera) {
      const raycaster = camera.getAttribute('raycaster') || {}
      const existing  = raycaster.objects || '.cantap'

      // 이미 .cantap이 포함되어 있으면 중복 추가 방지
      if (!existing.includes('.cantap')) {
        camera.setAttribute('raycaster', {
          ...raycaster,
          objects: `${existing}, .cantap`,
        })
      } else {
        camera.setAttribute('raycaster', {
          ...raycaster,
          objects: existing,
        })
      }
    }
  },
}

export {selectionPlaceComponent}
