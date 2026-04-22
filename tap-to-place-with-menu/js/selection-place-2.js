const selectionPlaceComponent = {
  init() {
    const container = document.getElementById('container')
    const ground    = document.getElementById('ground')
    const scene     = document.querySelector('a-scene')

    const entries = [
      {id: '#narcissusModel', img: './assets/icons/confetti.jpg'},
      {id: '#tulipModel',     img: './assets/icons/super-mario.jpg'},
      {id: '#margaritaModel', img: './assets/icons/basketball.jpg'},
      {id: 'eraser',          img: './assets/icons/eraser.jpg'},
    ]

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

    entries.forEach((entry, index) => {
      const btn = document.createElement('button')
      btn.classList.add('carousel')
      btn.style.backgroundImage = `url(${entry.img})`
      btn.addEventListener('click', (event) => {
        event.preventDefault()
        setEntry(index, btn)
      })
      container.appendChild(btn)
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

    // ─────────────────────────────────────────────────────────────────────
    // animation-mixer 적용 함수
    //
    // [수정 A] setAttribute에 객체 대신 '문자열' 방식으로 전달.
    //          aframe-extras 버전에 따라 객체 파싱이 실패하는 경우를 방지.
    //
    // [진단]   glTF에 애니메이션 클립이 실제로 있는지 콘솔에서 확인.
    //          클립 수가 0이면 glb 파일 자체에 애니메이션 데이터가 없는 것.
    // ─────────────────────────────────────────────────────────────────────
    function applyAnimationMixer(el) {
      const mesh  = el.getObject3D('mesh')
      const clips = (mesh && mesh.animations) ? mesh.animations : []

      console.log(`[animation-mixer 진단] 클립 수: ${clips.length}`)
      clips.forEach((c, i) => console.log(`  클립[${i}]: "${c.name}"`))

      if (clips.length === 0) {
        console.warn(
          '[animation-mixer] 애니메이션 클립이 없습니다. ' +
          'glb 파일에 애니메이션 데이터가 포함되어 있는지 확인하세요.'
        )
        return
      }

      // [수정 A] 문자열 방식으로 전달
      el.setAttribute('animation-mixer', 'clip: *; loop: repeat; crossFadeDuration: 0.3')
      console.log('[animation-mixer] 설정 완료')
    }

    // ─────────────────────────────────────────────────────────────────────
    // 씬 클릭 이벤트
    // ─────────────────────────────────────────────────────────────────────
    scene.addEventListener('click', (event) => {
      if (!canCreateObject) return

      const {intersectedEl, intersection} = event.detail

      if (isErasing) {
        // ── 지우개 모드 ──────────────────────────────────────────────────
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
          // [유지] dur(300) + 50ms 여유 → 애니메이션 완료 후 제거 보장
          setTimeout(() => {
            if (intersectedEl.parentNode) {
              intersectedEl.parentNode.removeChild(intersectedEl)
            }
          }, 350)
        }

      } else if (entries[currentEntry] && entries[currentEntry].id !== 'eraser') {
        // ── 오브젝트 배치 모드 ───────────────────────────────────────────
        if (!intersection?.point) return

        const newEl = document.createElement('a-entity')
        newEl.setAttribute('position', intersection.point)
        newEl.setAttribute('gltf-model', entries[currentEntry].id)
        newEl.setAttribute('visible', 'false')
        newEl.setAttribute('scale',   '0.0001 0.0001 0.0001')
        newEl.setAttribute('shadow',  'receive: false')
        newEl.classList.add('cantap')

        // ─────────────────────────────────────────────────────────────────
        // [수정 B] model-loaded 리스너를 appendChild 이전에 등록.
        //          appendChild 이후 등록하면 캐시된 모델은 이벤트가
        //          리스너보다 먼저 발화하여 animation-mixer가 누락됨.
        // ─────────────────────────────────────────────────────────────────
        newEl.addEventListener('model-loaded', () => {
          console.log('[model-loaded] 완료:', entries[currentEntry].id)

          // 등장 scale 애니메이션
          newEl.setAttribute('visible', 'true')
          newEl.setAttribute('animation', {
            property: 'scale',
            to:       '1 1 1',
            easing:   'easeOutElastic',
            dur:      800,
          })

          // ───────────────────────────────────────────────────────────────
          // [수정 C] animationcomplete 이벤트 방식 제거 → setTimeout으로 교체.
          //
          //          animationcomplete는 특정 조건(loop, fill 설정 등)에서
          //          발화하지 않는 경우가 있어 animation-mixer 설정이
          //          영원히 실행되지 않는 문제가 있었음.
          //
          //          scale 애니메이션 dur(800ms) + 여유(100ms) = 900ms 후
          //          animation-mixer 설정 → 등장 애니메이션과 충돌 없음.
          // ───────────────────────────────────────────────────────────────
          setTimeout(() => {
            applyAnimationMixer(newEl)
          }, 900)
        })

        scene.appendChild(newEl)
        console.log('[배치] 모델 추가:', entries[currentEntry].id)

        canCreateObject = false
        setTimeout(() => { canCreateObject = true }, 200)
      }
    })

    // ─────────────────────────────────────────────────────────────────────
    // raycaster 업데이트
    // [수정 D] getAttribute로 현재 값 읽어 객체 스프레드로 재설정.
    //          중복 .cantap 추가 방지.
    // ─────────────────────────────────────────────────────────────────────
    const camera = document.querySelector('a-camera')
    if (camera) {
      const raycaster = camera.getAttribute('raycaster') || {}
      const existing  = (raycaster.objects || '.cantap').trim()
      if (!existing.includes('.cantap')) {
        camera.setAttribute('raycaster', {
          ...raycaster,
          objects: `${existing}, .cantap`,
        })
      }
    }
  },
}

export {selectionPlaceComponent}
