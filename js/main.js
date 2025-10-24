document.addEventListener('DOMContentLoaded', function(){
  // set year
  const y = new Date().getFullYear();
  const yearEl = document.getElementById('year');
  if(yearEl) yearEl.textContent = y;

  // menu toggle
  const btn = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.nav');
  if(btn && nav){
    btn.addEventListener('click', (e)=>{
      e.stopPropagation();
      if(window.innerWidth <= 900){
        nav.classList.toggle('nav-open');
      }
    });
    // Close mobile nav when clicking outside
    window.addEventListener('click', (e)=>{
      if(window.innerWidth <= 900){
        if(!nav.contains(e.target) && !btn.contains(e.target)){
          nav.classList.remove('nav-open');
        }
      }
    });
  }

  // Dropdown toggles (for mobile / click)
  document.querySelectorAll('.nav-item.dropdown').forEach(item => {
    const toggle = item.querySelector('.dropdown-toggle');
    const menu = item.querySelector('.dropdown-menu');
    if(!toggle || !menu) return;
    toggle.addEventListener('click', (e)=>{
      e.stopPropagation();
      const wasOpen = menu.classList.contains('open');
      // close all other dropdowns
      document.querySelectorAll('.dropdown-menu.open').forEach(m=> m.classList.remove('open'));
      if(!wasOpen){
        menu.classList.add('open');
      }
      toggle.setAttribute('aria-expanded', String(!wasOpen));
    });
    // Prevent clicks inside the dropdown from bubbling to the window handler
    menu.addEventListener('click', (e)=>{ e.stopPropagation(); });
    // When a link inside the dropdown is clicked on small screens, close the mobile nav for clarity
    menu.querySelectorAll('a').forEach(a=> a.addEventListener('click', ()=>{
      if(window.innerWidth <= 900){
        const navEl = document.querySelector('.nav');
        if(navEl) navEl.classList.remove('nav-open');
        // also close any open dropdowns
        document.querySelectorAll('.dropdown-menu.open').forEach(m=> m.classList.remove('open'));
      }
    }));
  });
  // Close dropdowns when clicking elsewhere (but only if the click is outside the nav)
  window.addEventListener('click', (e)=>{
    // if click is inside the navigation, keep dropdowns open (handlers will manage open/close)
    if(e && e.target && e.target.closest && e.target.closest('.nav')) return;
    document.querySelectorAll('.dropdown-menu.open').forEach(m=> m.classList.remove('open'));
  });

  // background video: play muted and loop between start and end times
  const video = document.getElementById('bgVideo');
  if(video){
    // set attributes explicitly
    video.muted = true;
    video.playsInline = true;

    const start = 5; // seconds
    const end = 17; // seconds

    // Ensure video is ready, then start at `start` seconds
    const ensurePlaySegment = ()=>{
      try{
        if(video.readyState >= 2){
          // clamp duration
          if(video.duration && video.duration > start){
            video.currentTime = start;
          }
          const playPromise = video.play();
          if(playPromise && typeof playPromise.then === 'function'){
            playPromise.catch(()=>{
              // Autoplay might be blocked; rely on user interaction
            });
          }
        }
      }catch(e){
        // ignore
      }
    };

    // On timeupdate, loop when passed end
    video.addEventListener('timeupdate', ()=>{
      if(video.currentTime >= end){
        video.currentTime = start;
      }
    });

    // Try to start when metadata loaded
    video.addEventListener('loadedmetadata', ensurePlaySegment);
    video.addEventListener('canplay', ensurePlaySegment);

    // Mobile/Autoplay fallback: try to play on first user interaction
    const resumeOnInteraction = ()=>{
      ensurePlaySegment();
      window.removeEventListener('click', resumeOnInteraction);
      window.removeEventListener('touchstart', resumeOnInteraction);
    };
    window.addEventListener('click', resumeOnInteraction);
    window.addEventListener('touchstart', resumeOnInteraction);
  }

  // Language toggle: persist selection and update html[data-lang]
  (function(){
    const langToggle = document.getElementById('langToggle');
    const root = document.documentElement;
    // initialize from localStorage or html attribute
    const saved = localStorage.getItem('siteLang');
    if(saved){ root.setAttribute('data-lang', saved); }
    // When toggle clicked, flip between 'te' and 'en'
    if(langToggle){
      langToggle.addEventListener('click', ()=>{
        const cur = root.getAttribute('data-lang') || (root.lang || 'te');
        const next = cur === 'te' ? 'en' : 'te';
        root.setAttribute('data-lang', next);
        localStorage.setItem('siteLang', next);
      });
    }
  })();

  // donation amount quick select
  document.querySelectorAll('.amt').forEach(b=>{
    b.addEventListener('click', e=>{
      document.querySelectorAll('.amt').forEach(x=>x.classList.remove('selected'));
      e.currentTarget.classList.add('selected');
      // simple demo: copy amount into console
      console.log('Selected donation', e.currentTarget.textContent);
    })
  });

  // PDF viewer using PDF.js
  (function(){
    const form = document.getElementById('pdfGotoForm');
    const pageInput = document.getElementById('pageNumber');
    const goBtn = document.getElementById('goPdf');
    const canvas = document.getElementById('pdfCanvas');
    if(!(form && pageInput && goBtn && canvas && window.pdfjsLib)) return;

    // PDF.js setup
  const PDF_URL = 'andhra_christava_keerthanalu.pdf';
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.10.130/pdf.worker.min.js';

    let pdfDoc = null;
    let currentPage = 1;

    const ctx = canvas.getContext('2d');

    function renderPage(pageNum){
      pdfDoc.getPage(pageNum).then(page=>{
        const viewport = page.getViewport({ scale: 1.5 });
        const scale = (canvas.parentElement.clientWidth) / viewport.width * 1.0;
        const scaledViewport = page.getViewport({ scale: viewport.scale * scale });
        canvas.width = Math.floor(scaledViewport.width);
        canvas.height = Math.floor(scaledViewport.height);
        const renderContext = {
          canvasContext: ctx,
          viewport: scaledViewport
        };
        page.render(renderContext);
      }).catch(err=>{
        console.error('Error rendering page', err);
        alert('Unable to render requested page.');
      });
    }

    // Load document (try PDF.js). If it fails (for example when opened via file://),
    // fall back to a simple iframe viewer which relies on the browser's PDF plugin.
    let usePdfJs = false;
    const viewerContainer = document.querySelector('.pdf-viewer-container');

    const fallbackToIframe = (page=1)=>{
      usePdfJs = false;
      if(!viewerContainer) return;
      // Replace viewer contents with an iframe that navigates to the requested page.
      viewerContainer.innerHTML = '<iframe id="pdfFallbackIframe" src="' + PDF_URL + '#page=' + page + '" frameborder="0" style="width:100%;height:640px;border:0;display:block" aria-label="PDF fallback viewer"></iframe>';
    };

    pdfjsLib.getDocument(PDF_URL).promise.then(doc=>{
      pdfDoc = doc;
      usePdfJs = true;
      // Render initial page 1
      renderPage(1);
    }).catch(err=>{
      console.warn('PDF.js failed to load PDF (falling back to iframe). Error:', err);
      // Try iframe fallback (works when file is accessible via browser plugin)
      fallbackToIframe(1);
    });

    const goTo = ()=>{
      const v = parseInt(pageInput.value, 10);
      if(!v || v < 1){
        alert('Please enter a page number (1 or greater)');
        return;
      }
      if(usePdfJs){
        if(!pdfDoc){
          alert('PDF is still loading, try again in a moment');
          return;
        }
        if(v > pdfDoc.numPages){
          alert('Requested page exceeds number of pages in document (' + pdfDoc.numPages + ')');
          return;
        }
        currentPage = v;
        renderPage(currentPage);
      }else{
        // iframe fallback: update src to requested page
        const fb = document.getElementById('pdfFallbackIframe');
        if(fb){
          fb.src = PDF_URL + '#page=' + v + '&' + Date.now();
        }else if(viewerContainer){
          fallbackToIframe(v);
        }
      }
    };

    goBtn.addEventListener('click', (e)=>{ e.preventDefault(); goTo(); });
    pageInput.addEventListener('keypress', (e)=>{ if(e.key === 'Enter'){ e.preventDefault(); goTo(); } });

    // Responsive: re-render on resize to fit width
    let resizeTimeout = null;
    window.addEventListener('resize', ()=>{
      if(!pdfDoc) return;
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(()=>{ renderPage(currentPage); }, 150);
    });
  })();

  /* Events, Calendar and Prayer features */
  (function(){
    // Sample events data (categories and photos)
    const events = [
      {
        id: 1,
        title: 'Centenary Celebration',
        category: 'Celebration',
        date: '2025-10-08',
        photos: ['events/cent1.jpg','events/cent2.jpg','events/cent3.jpg']
      },
      {
        id: 2,
        title: 'Youth Retreat',
        category: 'Retreat',
        date: '2025-09-21',
        photos: ['events/retreat1.jpg','events/retreat2.jpg']
      },
      {
        id: 3,
        title: 'Outreach Day',
        category: 'Outreach',
        date: '2025-10-15',
        photos: ['events/out1.jpg','events/out2.jpg','events/out3.jpg','events/out4.jpg']
      }
    ];

    const eventsGrid = document.getElementById('eventsGrid');
    if(eventsGrid){
      events.forEach(ev=>{
        const card = document.createElement('article');
        card.className = 'event-card';
        card.dataset.eventId = ev.id;

        const slide = document.createElement('div');
        slide.className = 'event-slideshow';
        slide.dataset.index = 0;
        const img = document.createElement('img');
        img.src = ev.photos[0];
        img.alt = ev.title + ' photo';
        slide.appendChild(img);
        const count = document.createElement('div');
        count.className = 'photo-count';
        count.textContent = ev.photos.length + ' photos';
        slide.appendChild(count);

        const body = document.createElement('div');
        body.className = 'event-body';
        body.innerHTML = `<h3>${ev.title}</h3><div class="event-meta">${ev.category} · ${ev.date}</div>`;

        card.appendChild(slide);
        card.appendChild(body);
        eventsGrid.appendChild(card);

        // slideshow behavior
        if(ev.photos.length > 1){
          let idx = 0;
          const imgs = ev.photos;
          let interval = setInterval(()=>{
            idx = (idx + 1) % imgs.length;
            img.src = imgs[idx];
            slide.dataset.index = idx;
          }, 2500);

          // pause on hover or click
          slide.addEventListener('mouseenter', ()=> clearInterval(interval));
          slide.addEventListener('mouseleave', ()=>{
            interval = setInterval(()=>{ idx = (idx + 1) % imgs.length; img.src = imgs[idx]; slide.dataset.index = idx; }, 2500);
          });
          slide.addEventListener('click', ()=>{
            // advance manually on click
            idx = (idx + 1) % imgs.length; img.src = imgs[idx]; slide.dataset.index = idx;
          });
        }
      });
    }

    // Calendar: render current month and mark event dates in red
    const calendarGrid = document.getElementById('calendarGrid');
    const calendarMonth = document.getElementById('calendarMonth');
    const prevBtn = document.getElementById('prevMonth');
    const nextBtn = document.getElementById('nextMonth');

    let today = new Date();
    let viewYear = today.getFullYear();
    let viewMonth = today.getMonth(); // 0-indexed

    function renderCalendar(year, month){
      if(!calendarGrid || !calendarMonth) return;
      calendarGrid.innerHTML = '';
      const first = new Date(year, month, 1);
      const last = new Date(year, month + 1, 0);
      const monthName = first.toLocaleString(undefined, { month: 'long' });
      calendarMonth.textContent = `${monthName} ${year}`;

      // Weekday headings
      const weekdays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      weekdays.forEach(w=>{
        const h = document.createElement('div');
        h.className = 'calendar-day';
        h.innerHTML = `<div class="date-num">${w}</div>`;
        calendarGrid.appendChild(h);
      });

      // Fill blanks before first day
      for(let i=0;i<first.getDay();i++){
        const blank = document.createElement('div');
        blank.className = 'calendar-day';
        calendarGrid.appendChild(blank);
      }

      // days
      for(let d=1; d<= last.getDate(); d++){
        const dt = new Date(year, month, d);
        const cell = document.createElement('div');
        cell.className = 'calendar-day';
        cell.innerHTML = `<div class="date-num">${d}</div>`;

        // check events
        const iso = dt.toISOString().slice(0,10);
        const has = events.find(e=>e.date === iso);
        if(has){
          cell.classList.add('event');
          const evBadge = document.createElement('div');
          evBadge.style.position = 'absolute'; evBadge.style.left='8px'; evBadge.style.bottom='8px'; evBadge.style.fontSize='0.75rem'; evBadge.style.color='#ef4444';
          evBadge.textContent = has.title;
          cell.appendChild(evBadge);
        }

        calendarGrid.appendChild(cell);
      }
    }

    if(calendarGrid){
      renderCalendar(viewYear, viewMonth);
      prevBtn.addEventListener('click', ()=>{ viewMonth--; if(viewMonth<0){ viewMonth=11; viewYear--; } renderCalendar(viewYear, viewMonth); });
      nextBtn.addEventListener('click', ()=>{ viewMonth++; if(viewMonth>11){ viewMonth=0; viewYear++; } renderCalendar(viewYear, viewMonth); });
    }

    // Prayer wall: store to localStorage
    const prayerForm = document.getElementById('prayerForm');
    const prayerWall = document.getElementById('prayerWall');
    const pName = document.getElementById('prayerName');
    const pText = document.getElementById('prayerText');
    const pAnon = document.getElementById('prayerAnon');

    function loadPrayers(){
      const raw = localStorage.getItem('prayerWall') || '[]';
      try{
        return JSON.parse(raw);
      }catch(e){ return []; }
    }
    function savePrayers(arr){ localStorage.setItem('prayerWall', JSON.stringify(arr)); }
    async function renderPrayers(){
      if(!prayerWall) return;
      prayerWall.innerHTML = '';
      // Try to fetch approved prayers from server first
      try{
        const resp = await fetch('/api/prayers', {credentials: 'same-origin'});
        if(resp.ok){
          const serverList = await resp.json();
          if(Array.isArray(serverList) && serverList.length){
            serverList.slice().reverse().forEach(item=>{
              const div = document.createElement('div');
              div.className = 'prayer-item';
              const name = item.name || item.memberName || 'Guest';
              const time = new Date((item.ts||item.ts===0)?item.ts*1:item.ts).toLocaleString();
              div.innerHTML = `<div class="meta">${time} · ${ (item.anon? 'Anonymous' : name) }</div><div class="text">${item.text}</div>`;
              prayerWall.appendChild(div);
            });
            return;
          }
        }
      }catch(e){ /* ignore and fallback to localStorage */ }

      // Fallback to localStorage
      const list = loadPrayers().slice().reverse();
      list.forEach(item=>{
        const div = document.createElement('div');
        div.className = 'prayer-item';
        const name = item.anon ? 'Anonymous' : (item.name || 'Guest');
        const time = new Date(item.ts).toLocaleString();
        div.innerHTML = `<div class="meta">${time} · ${name}</div><div class="text">${item.text}</div>`;
        prayerWall.appendChild(div);
      });
    }

    if(prayerForm){
  prayerForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        // Collect form data as before
        const text = pText.value.trim();
        const name = pName.value.trim();
        const anon = pAnon.checked;

        if(!text) return alert('Please enter a prayer request');
        // Try to POST to server submit endpoint; fallback to localStorage pendingPrayers
        try{
          const res = await fetch('/submit/prayer', {
            method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({name, anon, text, ts: Date.now()})
          });
          const j = await res.json().catch(()=>null);
          if(res.ok && j && j.success){
            alert('Your prayer request has been submitted for review. It will appear on the wall once approved.');
            this.reset();
            return;
          }
        }catch(e){ /* fallthrough */ }
        // Fallback: save locally
        let pendingPrayers = JSON.parse(localStorage.getItem('pendingPrayers') || '[]');
        pendingPrayers.push({
          ts: Date.now(),
          name: name,
          anon: anon,
          text: text
        });
        localStorage.setItem('pendingPrayers', JSON.stringify(pendingPrayers));
        alert('Your prayer request has been submitted for review (offline). It will appear on the wall once approved.');
        this.reset();
      });
      // Seed examples if empty
      if(loadPrayers().length === 0){
        const examples = [
          {name:'Alice', text:'Please pray for my mother who is unwell.', anon:false, ts: Date.now() - 1000*60*60*24*2},
          {name:'Bob', text:'Pray for our youth ministry outreach.', anon:false, ts: Date.now() - 1000*60*60*24*4},
          {name:'Carol', text:'Healing and peace for the family.', anon:true, ts: Date.now() - 1000*60*60*24*6},
          {name:'Daniel', text:'Guidance for our leadership team.', anon:false, ts: Date.now() - 1000*60*60*24*8},
          {name:'Eve', text:'Thankful for recent blessings.', anon:false, ts: Date.now() - 1000*60*60*24*10}
        ];
        savePrayers(examples);
      }
      // Clean old prayers older than 30 days
      const now = Date.now();
      const fresh = loadPrayers().filter(p => (now - p.ts) <= (1000*60*60*24*30));
      savePrayers(fresh);
      renderPrayers();

      // Auto-scroll prayer wall slowly
      function startPrayerScroll(){
        if(!prayerWall) return;
        let scrollAmount = 0;
        const step = 0.5; // pixels per tick
        function tick(){
          if(prayerWall.scrollHeight - prayerWall.clientHeight <= 1){ return; }
          prayerWall.scrollTop = (prayerWall.scrollTop + step) % (prayerWall.scrollHeight - prayerWall.clientHeight + 1);
        }
        return setInterval(tick, 40);
      }
      let prayerScrollInterval = startPrayerScroll();
      prayerWall.addEventListener('mouseenter', ()=> clearInterval(prayerScrollInterval));
      prayerWall.addEventListener('mouseleave', ()=> { prayerScrollInterval = startPrayerScroll(); });
    }

    // Outreach slideshow
    const outreachSlideshow = document.getElementById('outreachSlideshow');
    if(outreachSlideshow){
      const slides = outreachSlideshow.querySelectorAll('.slide');
      const dots = outreachSlideshow.querySelector('.slide-dots');
      let currentSlide = 0;
      let slideInterval;

      // Create dots
      slides.forEach((_,i) => {
        const dot = document.createElement('button');
        dot.setAttribute('aria-label', `Go to slide ${i+1}`);
        dot.addEventListener('click', () => goToSlide(i));
        dots.appendChild(dot);
      });
      const dotButtons = dots.querySelectorAll('button');

      function updateSlides(){
        slides.forEach(s => s.classList.remove('active'));
        dotButtons.forEach(d => d.classList.remove('active'));
        slides[currentSlide].classList.add('active');
        dotButtons[currentSlide].classList.add('active');
      }

      function goToSlide(n){
        currentSlide = n;
        updateSlides();
      }

      function nextSlide(){
        currentSlide = (currentSlide + 1) % slides.length;
        updateSlides();
      }

      function prevSlide(){
        currentSlide = (currentSlide - 1 + slides.length) % slides.length;
        updateSlides();
      }

      // Controls
      outreachSlideshow.querySelector('.prev').addEventListener('click', prevSlide);
      outreachSlideshow.querySelector('.next').addEventListener('click', nextSlide);

      // Auto advance
      function startSlideshow(){
        slideInterval = setInterval(nextSlide, 5000);
      }
      function pauseSlideshow(){
        clearInterval(slideInterval);
      }

      outreachSlideshow.addEventListener('mouseenter', pauseSlideshow);
      outreachSlideshow.addEventListener('mouseleave', startSlideshow);

      // Initialize
      updateSlides();
      startSlideshow();
    }

    // Membership form handling
    const membershipForm = document.getElementById('membershipForm');
    if(membershipForm){
        // Children table behavior: add/remove rows and serialize
        const addChildBtn = document.getElementById('addChildBtn');
        const childrenTable = document.getElementById('childrenTable');
        function refreshChildIndices(){
          const trs = childrenTable.querySelectorAll('tbody tr');
          trs.forEach((tr, i)=>{ tr.querySelector('.child-idx').textContent = String(i+1); });
        }
        function createChildRow(data={}){
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td class="child-idx"></td>
            <td><input class="child-name" type="text" value="${(data.name||'')}"></td>
            <td><input class="child-phone" type="tel" value="${(data.phone||'')}"></td>
            <td><input class="child-age" type="number" value="${(data.age||'')}"></td>
            <td><input class="child-eduocc" type="text" value="${(data.eduocc||'')}"></td>
            <td><input class="child-address" type="text" value="${(data.address||'')}"></td>
            <td><button type="button" class="btn remove-child">✕</button></td>
          `;
          tr.querySelector('.remove-child').addEventListener('click', ()=>{ tr.remove(); refreshChildIndices(); });
          childrenTable.querySelector('tbody').appendChild(tr);
          refreshChildIndices();
        }
        if(addChildBtn){ addChildBtn.addEventListener('click', ()=> createChildRow()); }
      membershipForm.addEventListener('submit', function(e) {
        e.preventDefault();
        // Collect form data and validate duplicates
        let applications = JSON.parse(localStorage.getItem('membershipApplications') || '[]');
        const name = document.getElementById('memberName').value.trim();
        const phone = document.getElementById('memberPhone').value.trim();
        const email = document.getElementById('memberEmail').value.trim().toLowerCase();

        // Duplicate checks: name, phone, email
        const dup = applications.find(a => (a.name && a.name.trim().toLowerCase() === name.toLowerCase()) || (a.phone && a.phone === phone) || (a.email && a.email.toLowerCase() === email));
        if(dup){
          alert('An application with the same name, phone or email already exists. Please check your details.');
          return;
        }

        let appNumber = applications.length + 1;
        // Build children array from the childrenTable if present
        let childrenArr = [];
        const childrenTbody = document.querySelector('#childrenTable tbody');
        if(childrenTbody){
          childrenTbody.querySelectorAll('tr').forEach(tr=>{
            const c = {
              name: (tr.querySelector('.child-name') && tr.querySelector('.child-name').value) || '',
              phone: (tr.querySelector('.child-phone') && tr.querySelector('.child-phone').value) || '',
              age: (tr.querySelector('.child-age') && tr.querySelector('.child-age').value) || '',
              eduocc: (tr.querySelector('.child-eduocc') && tr.querySelector('.child-eduocc').value) || '',
              address: (tr.querySelector('.child-address') && tr.querySelector('.child-address').value) || ''
            };
            // only include if name or phone present
            if(c.name || c.phone) childrenArr.push(c);
          });
        }

        // Save form data, including photo/signature filename (actual upload handling needs backend)
        const appObj = {
          ts: Date.now(),
          appNumber: appNumber,
          name: name,
          dob: document.getElementById('memberDob').value,
          birthPlace: document.getElementById('memberBirthPlace') ? document.getElementById('memberBirthPlace').value : '',
          phone: phone,
          email: email,
          address: document.getElementById('memberAddress').value,
          bloodGroup: document.getElementById('memberBloodGroup') ? document.getElementById('memberBloodGroup').value : '',
          christianStatus: document.getElementById('memberChristianStatus') ? document.getElementById('memberChristianStatus').value : '',
          baptismPastor: document.getElementById('memberBaptismPastor') ? document.getElementById('memberBaptismPastor').value : '',
          baptismYear: document.getElementById('memberBaptismYear') ? document.getElementById('memberBaptismYear').value : '',
          education: document.getElementById('memberEducation') ? document.getElementById('memberEducation').value : '',
          otherQualifications: document.getElementById('memberOtherQualifications') ? document.getElementById('memberOtherQualifications').value : '',
          baptized: document.getElementById('memberBaptized').value,
          prevChurch: document.getElementById('memberPrevChurch').value,
          why: document.getElementById('memberWhy').value,
          familyPhoto: document.getElementById('familyPhoto') ? document.getElementById('familyPhoto').value : '',
          gender: document.getElementById('memberGender').value,
          occupation: document.getElementById('memberOccupation') ? document.getElementById('memberOccupation').value : '',
          aadhar: document.getElementById('memberAadhar') ? document.getElementById('memberAadhar').value : '',
          fatherName: document.getElementById('memberFatherName') ? document.getElementById('memberFatherName').value : '',
          fatherOccupation: document.getElementById('memberFatherOcc') ? document.getElementById('memberFatherOcc').value : '',
          motherName: document.getElementById('memberMotherName') ? document.getElementById('memberMotherName').value : '',
          motherOccupation: document.getElementById('memberMotherOcc') ? document.getElementById('memberMotherOcc').value : '',
          spouseName: document.getElementById('memberSpouseName') ? document.getElementById('memberSpouseName').value : '',
          spouseOccupation: document.getElementById('memberSpouseOcc') ? document.getElementById('memberSpouseOcc').value : '',
          caste: document.getElementById('memberCaste').value,
          disability: document.getElementById('memberDisability').value,
          age: document.getElementById('memberAge').value,
          marital: document.getElementById('memberMarital').value,
          children: JSON.stringify(childrenArr),
          declaration: document.getElementById('memberDeclaration') ? document.getElementById('memberDeclaration').value : '',
          declarationDate: document.getElementById('memberDeclarationDate') ? document.getElementById('memberDeclarationDate').value : '',
          declarationPlace: document.getElementById('memberDeclarationPlace') ? document.getElementById('memberDeclarationPlace').value : '',
          signature: document.getElementById('memberSignature') ? document.getElementById('memberSignature').value : ''
        };
        applications.push(appObj);
        localStorage.setItem('membershipApplications', JSON.stringify(applications));
        document.getElementById('membershipAck').textContent =
          'Thank you! Your application number is: ' + appNumber + '. We have received your application.';
        this.reset();
      });
      // Add download button behaviour
      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'btn';
      downloadBtn.textContent = 'Download Applications';
      downloadBtn.style.marginTop = '0.5rem';
      const right = document.querySelector('.membership-right');
      if(right) right.appendChild(downloadBtn);
      downloadBtn.addEventListener('click', ()=>{
        const key = 'membershipApplications';
        const raw = localStorage.getItem(key) || '[]';
        const arr = JSON.parse(raw);
        if(arr.length === 0) return alert('No applications to download');
        // Build CSV
  const headers = ['ts','appNumber','name','dob','birthPlace','phone','email','address','bloodGroup','christianStatus','baptismPastor','baptismYear','education','otherQualifications','occupation','aadhar','fatherName','fatherOccupation','motherName','motherOccupation','spouseName','spouseOccupation','baptized','prevChurch','why','familyPhoto','gender','caste','disability','age','marital','children'];
        const rows = arr.map(a => headers.map(h => '"'+String(a[h]||'').replace(/"/g,'""')+'"').join(','));
        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'membership_applications.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      });
    }

    // Export handlers: try to POST to a local server (saves files into CABC/storage/) and
    // fall back to the original download + Drive-folder behavior when the server is unreachable.
    const DRIVE_FOLDER_URL = 'https://drive.google.com/drive/folders/1YZ6M9QNb0MIaNq1-gRfuWJ-_4VcsXLPh?usp=share_link';
    const exportPrayersBtn = document.getElementById('exportPrayers');
    const exportMembershipsBtn = document.getElementById('exportMemberships');

    // Change this if your server runs on a different host/port
    const SERVER_BASE = 'http://localhost:5000';

    function downloadBlob(filename, blob){
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    }

    if(exportPrayersBtn){
      exportPrayersBtn.addEventListener('click', async ()=>{
        const prayers = loadPrayers();
        if(!prayers || prayers.length === 0) return alert('No prayers to export');

        // Build CSV (kept for fallback)
        const headers = ['ts','name','anon','text'];
        const rows = prayers.map(p => headers.map(h=> '"'+String(p[h]||'').replace(/"/g,'""')+'"').join(','));
        const csv = [headers.join(','), ...rows].join('\n');

        // Try to POST to server
        try{
          const res = await fetch(SERVER_BASE + '/upload/prayers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(prayers)
          });
          if(res.ok){
            const j = await res.json().catch(()=>null);
            alert('Prayers uploaded to server.' + (j && j.files ? '\nSaved: ' + j.files.join(', ') : ''));
            return;
          }else{
            console.warn('Server returned', res.status, res.statusText);
            throw new Error('Server error');
          }
        }catch(err){
          console.warn('Upload to server failed, falling back to download:', err);
          const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
          downloadBlob('prayer_requests.csv', blob);
          // Open Drive folder for manual upload (legacy behavior)
          window.open(DRIVE_FOLDER_URL, '_blank');
        }
      });
    }

    if(exportMembershipsBtn){
      exportMembershipsBtn.addEventListener('click', async ()=>{
        const key = 'membershipApplications';
        const raw = localStorage.getItem(key) || '[]';
        const arr = JSON.parse(raw);
        if(arr.length === 0) return alert('No applications to export');

        const headers = ['ts','name','dob','phone','email','address','baptized','prevChurch','why'];
        const rows = arr.map(a => headers.map(h => '"'+String(a[h]||'').replace(/"/g,'""')+'"').join(','));
        const csv = [headers.join(','), ...rows].join('\n');

        // Try to POST to server
        try{
          const res = await fetch(SERVER_BASE + '/upload/memberships', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(arr)
          });
          if(res.ok){
            const j = await res.json().catch(()=>null);
            alert('Membership applications uploaded to server.' + (j && j.files ? '\nSaved: ' + j.files.join(', ') : ''));
            return;
          }else{
            console.warn('Server returned', res.status, res.statusText);
            throw new Error('Server error');
          }
        }catch(err){
          console.warn('Upload to server failed, falling back to download:', err);
          const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
          downloadBlob('membership_applications.csv', blob);
          window.open(DRIVE_FOLDER_URL, '_blank');
        }
      });
    }
  })();

  // Sermons: render latest video and previous thumbnails
  (async function(){
    const main = document.getElementById('sermonMain');
    const thumbs = document.getElementById('sermonThumbs');
    if(!main || !thumbs) return;
    function setMainVideo(id){
      main.innerHTML = `<iframe src="https://www.youtube.com/embed/${id}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe>`;
    }
    function renderFromList(items){
      if(!Array.isArray(items) || !items.length){ return false; }
      const first = items[0];
      setMainVideo(first.id);
      thumbs.innerHTML = '';
      items.forEach(v=>{
        const div = document.createElement('div');
        div.className = 'sermon-thumb';
        const img = document.createElement('img');
        img.src = v.thumb || `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`;
        img.alt = v.title || 'Video';
        const t = document.createElement('div'); t.className = 'title'; t.textContent = v.title || '';
        div.appendChild(img); div.appendChild(t);
        div.addEventListener('click', ()=> setMainVideo(v.id));
        thumbs.appendChild(div);
      });
      return true;
    }
    try{
      const r = await fetch('/data/sermons.json?_=' + Date.now());
      if(r.ok){
        const list = await r.json();
        if(renderFromList(list)) return;
      }
    }catch(e){ /* ignore */ }
    // Fallback: embed a search playlist for the channel handle
    main.innerHTML = `<iframe src="https://www.youtube.com/embed?listType=search&list=CABCKakinada" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen loading="lazy"></iframe>`;
    thumbs.innerHTML = '<em style="color:var(--muted);font-size:13px">Showing YouTube search results. Add data/sermons.json for curated videos.</em>';
  })();

  /* Google Sign-In setup and admin login/logout */
  (function(){
    const loginLink = document.getElementById('adminLoginLink');
    const dropdown = document.querySelector('.dropdown-menu');

    // Create logout link lazily
    let logoutLink = null;

    function ensureLogoutLink(){
      if(!dropdown) return null;
      if(logoutLink) return logoutLink;
      logoutLink = document.createElement('a');
      logoutLink.href = '#';
      logoutLink.id = 'adminLogoutLink';
      logoutLink.setAttribute('role','menuitem');
      logoutLink.innerHTML = '<span class="lang-te">లాగ్ అవుట్</span><span class="lang-en">Logout</span>';
      dropdown.appendChild(logoutLink);
      return logoutLink;
    }

    async function apiMe(){
      try{ const r = await fetch('/auth/me', {credentials: 'same-origin'}); return await r.json(); } catch(e){ return {user:null}; }
    }

    function loadScript(src){
      return new Promise((resolve, reject)=>{
        const s = document.createElement('script'); s.src = src; s.async = true; s.defer = true;
        s.onload = resolve; s.onerror = reject; document.head.appendChild(s);
      });
    }

    async function setupGoogle(){
      try{
        const cfgRes = await fetch('/config');
        const cfg = await cfgRes.json();
        const clientId = cfg.googleClientId || '';
        if(!clientId){
          console.warn('Missing GOOGLE_CLIENT_ID on server; Admin Login disabled.');
          return;
        }
        await loadScript('https://accounts.google.com/gsi/client');
        // Render button on demand; prefer Prompt flow to avoid layout shift
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response)=>{
            try{
              const r = await fetch('/auth/google/verify', {method:'POST', credentials: 'same-origin', headers:{'Content-Type':'application/json'}, body: JSON.stringify({id_token: response.credential})});
              const j = await r.json();
              if(j && j.success){
                alert('Signed in as ' + (j.user && j.user.email ? j.user.email : 'user'));
                updateUi(true);
                // Redirect to admin dashboard after successful login
                try{ setTimeout(()=>{ window.location.href = '/dashboard.html'; }, 200); }catch(e){}
              }else{
                alert('Login failed: ' + (j && j.message ? j.message : 'unknown'));
              }
            }catch(err){ alert('Login failed'); }
          }
        });
      }catch(e){ console.warn('Failed to setup Google Sign-In', e); }
    }

    async function doLogin(){
      if(window.google && window.google.accounts && window.google.accounts.id){
        // One Tap prompt
        window.google.accounts.id.prompt();
      }else{
        // Fallback: prompt for username/password
        const cfg = await (await fetch('/config')).json().catch(()=>({}));
        if(!cfg.googleClientId){
          const username = prompt('Admin username (email):');
          if(!username) return;
          const password = prompt('Password:');
          if(!password) return;
          try{
            const res = await fetch('/auth/login', {method:'POST', credentials: 'same-origin', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username, password})});
            const j = await res.json();
            if(j && j.success){
              alert('Signed in as ' + (j.user && j.user.email ? j.user.email : 'user'));
              updateUi(true);
              // Redirect to admin dashboard after successful login
              try{ setTimeout(()=>{ window.location.href = '/dashboard.html'; }, 200); }catch(e){}
            }else{
              alert('Login failed: ' + (j && j.message ? j.message : 'unknown'));
            }
          }catch(e){ alert('Login failed'); }
          return;
        }
        await setupGoogle();
        if(window.google && window.google.accounts && window.google.accounts.id){
          window.google.accounts.id.prompt();
        }
      }
    }

    async function doLogout(){
      try{ await fetch('/auth/logout', {method:'POST', credentials: 'same-origin'}); }catch(e){}
      updateUi(false);
    }

    async function updateUi(forceLoggedIn){
      const state = forceLoggedIn === true ? {user:{}} : (forceLoggedIn === false ? {user:null} : await apiMe());
      const loggedIn = !!(state && state.user);
      if(loginLink) loginLink.style.display = loggedIn ? 'none' : '';
      const ll = ensureLogoutLink(); if(ll) ll.style.display = loggedIn ? '' : 'none';
    }

    if(loginLink){ loginLink.addEventListener('click', (e)=>{ e.preventDefault(); doLogin(); }); }
    const ll = ensureLogoutLink(); if(ll){ ll.addEventListener('click', (e)=>{ e.preventDefault(); doLogout(); }); ll.style.display = 'none'; }

    // Initialize
    setupGoogle();
    updateUi();
  })();

  // Scroll reveal helper: elements with `data-reveal` will animate into view
  document.addEventListener('DOMContentLoaded', ()=>{
    const els = document.querySelectorAll('[data-reveal]');
    if(!els.length) return;
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(entry=>{
        if(entry.isIntersecting){
          entry.target.classList.add('revealed');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    els.forEach(el=> io.observe(el));
  });

  // Fallback: some browsers or immediate render situations may not trigger
  // the IntersectionObserver for elements already in view. Ensure the
  // history section and any other reveal elements become visible after a
  // short timeout.
  document.addEventListener('DOMContentLoaded', ()=>{
    setTimeout(()=>{
      try{
        const els = document.querySelectorAll('[data-reveal]');
        els.forEach(el=>{
          if(!el.classList.contains('revealed')){
            el.classList.add('revealed');
          }
        });
      }catch(e){/* ignore */}
    }, 120);
  });

  // main front-end behaviours: membership form submit -> POST /api/memberships

  (function () {
    // Helper to show acknowledgement
    function showAck(html, isError) {
      var ack = document.getElementById('membershipAck');
      if (!ack) return;
      ack.innerHTML = html;
      ack.style.padding = '0.5rem';
      ack.style.borderRadius = '6px';
      ack.style.marginTop = '0.5rem';
      ack.style.background = isError ? '#fee' : '#eefbea';
      ack.style.border = isError ? '1px solid #f5c6cb' : '1px solid #c3e6cb';
      ack.setAttribute('role', 'status');
    }

    // Membership form submit handler
    var form = document.getElementById('membershipForm');
    if (form) {
      form.addEventListener('submit', function (ev) {
        ev.preventDefault();

        var submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;

        var fd = new FormData(form);

        fetch('/api/memberships', {
          method: 'POST',
          body: fd
        }).then(function (res) {
          return res.json().catch(function () { return { success: false, message: 'Invalid server response' }; });
        }).then(function (data) {
          if (data && data.success) {
            var msg = '<strong>Application submitted.</strong> Thank you.';

            if (data.file_url) {
              msg += ' Uploaded photo: <a href="' + data.file_url + '" target="_blank" rel="noopener">' + data.file_name + '</a>';
            }
            showAck(msg, false);
            form.reset();
          } else {
            showAck('<strong>Error:</strong> ' + (data && data.message ? data.message : 'Unknown error'), true);
          }
        }).catch(function (err) {
          showAck('<strong>Error:</strong> Network or server error', true);
        }).finally(function () {
          if (submitBtn) submitBtn.disabled = false;
        });
      });
    }

    // Songbook popup logic
    function openSongModal(url, title) {
      var modal = document.getElementById('songModal');
      var iframe = document.getElementById('songFrame');
      var modalTitle = document.getElementById('songModalTitle');
      if (!modal || !iframe) {
        // fallback: open in new tab
        window.open(url, '_blank', 'noopener');
        return;
      }
      iframe.src = url;
      if (modalTitle && title) modalTitle.textContent = title;
      modal.style.display = 'block';
      modal.setAttribute('aria-hidden', 'false');
    }

    function closeSongModal() {
      var modal = document.getElementById('songModal');
      var iframe = document.getElementById('songFrame');
      if (!modal) return;
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
      // clear iframe to stop playback/navigation
      if (iframe) iframe.src = '';
    }

    var goBtn = document.getElementById('goSong');
    if (goBtn) {
      goBtn.addEventListener('click', function (ev) {
        ev.preventDefault();
        var numInput = document.getElementById('songNumber');
        var val = (numInput && numInput.value) ? String(numInput.value).trim() : '';
        if (!val || isNaN(val) || Number(val) < 1) {
          alert('Please enter a valid song number (1 or higher).');
          return;
        }
        // build URL
        var url = 'http://akkonline.joelnetwork.com/songs/' + encodeURIComponent(val) + '.html';
        // attempt to open in modal; if remote site prevents embedding, user can use download/open in new tab
        openSongModal(url, 'Song ' + val);
      });
    }

    var closeBtn = document.getElementById('songCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', function () {
      closeSongModal();
    });

    var backdrop = document.getElementById('songBackdrop');
    if (backdrop) backdrop.addEventListener('click', function () {
      closeSongModal();
    });

    // Optional: if iframe fails to load (X-Frame-Options), open in new tab after short timeout
    var iframe = document.getElementById('songFrame');
    if (iframe) {
      iframe.addEventListener('error', function () {
        var src = iframe.src;
        closeSongModal();
        if (src) window.open(src, '_blank', 'noopener');
      });
    }

    // Keep prayer behaviour unchanged (requests still appended client-side).
  })();

  // Promise Card modal handling
  (function(){
    var openCanva = document.getElementById('openCanva');
    var modal = document.getElementById('promiseModal');
    var closeBtn = document.getElementById('promiseCloseBtn');
    var backdrop = document.getElementById('promiseBackdrop');
    var promiseImg = document.getElementById('promiseImg');

    if(openCanva){
      openCanva.addEventListener('click', function(ev){
        // open modal instead of navigating away
        ev.preventDefault();
        if(modal){
          modal.style.display = 'flex';
          modal.setAttribute('aria-hidden','false');
          // focus close button for keyboard users
          if(closeBtn) closeBtn.focus();
        }
      });
    }

    function closeModal(){
      if(!modal) return;
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden','true');
    }

    if(closeBtn) closeBtn.addEventListener('click', function(){ closeModal(); });
    if(backdrop) backdrop.addEventListener('click', function(){ closeModal(); });

    // Close on Escape key
    window.addEventListener('keydown', function(e){
      if(e.key === 'Escape' || e.key === 'Esc'){
        if(modal && modal.style.display !== 'none'){
          closeModal();
        }
      }
    });

  })();

  /* Church Members directory: fetch from Google Sheet and render searchable list */
  (function(){
    const membersGrid = document.getElementById('membersGrid');
    const status = document.getElementById('membersStatus');
    const searchInput = document.getElementById('memberSearch');
    if(!membersGrid || !searchInput) return;

    const SHEET_GID = '399213448';
    const SHEET_ID = '1O8oWqIT-i8FmvOCMqCroA-axC9OHMqhJeRUbn_IoDZ4';
    const GVIZ = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?gid=${SHEET_GID}`;

    let members = [];

    function setStatus(msg){ if(status) status.textContent = msg; }

    function parseGvizText(text){
      // GH: gviz responds with: "/*O_o*/\ngoogle.visualization.Query.setResponse({...})"
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if(start === -1 || end === -1) return null;
      const json = text.slice(start, end+1);
      try{ return JSON.parse(json); }catch(e){ return null; }
    }

    function rowToObj(cols, row){
      const obj = {};
      cols.forEach((c, i)=>{
        const v = (row.c && row.c[i]) ? (row.c[i].v || '') : '';
        obj[c.label || c.id || `c${i}`] = v;
      });
      return obj;
    }

    async function loadSheet(){
      setStatus('Loading members...');
      try{
        const res = await fetch(GVIZ);
        if(!res.ok) throw new Error('Network response not ok');
        const text = await res.text();
        const data = parseGvizText(text);
        if(!data || !data.table) throw new Error('Unexpected sheet response');
        const cols = data.table.cols;
        const rows = data.table.rows || [];
        members = rows.map(r => rowToObj(cols, r));
        setStatus(`Loaded ${members.length} members`);
        renderMembers(members);
      }catch(err){
        console.warn('Failed to load sheet', err);
        setStatus('Unable to load members from the sheet. Make sure the sheet is public.');
      }
    }

    function mkCard(m){
      const card = document.createElement('article');
      card.className = 'member-card';
      const photo = document.createElement('div'); photo.className = 'm-photo';
      const img = document.createElement('img');
      img.src = m.Photo || m.photo || 'uploads/Crucifixion-of-Jesus_20251016163744.jpg';
      img.alt = m.Name || m.name || 'Member photo';
      photo.appendChild(img);

      const info = document.createElement('div'); info.className = 'm-info';
      const h = document.createElement('h5');
      h.innerHTML = `<span class=\"lang-te\">${m['Name (TE)']||m['NameTE']||m.Name||''}</span><span class=\"lang-en\">${m['Name (EN)']||m['NameEN']||m.Name||''}</span>`;
      const meta = document.createElement('div'); meta.className = 'm-meta';
      const baptized = m['Baptism Date'] || m.Baptism || m.Baptized || '';
      const memberSince = m['Member Since'] || m['Church Member Since'] || m.Since || '';
      meta.textContent = `Baptized: ${baptized} · Member since: ${memberSince}`;
      const contact = document.createElement('div'); contact.innerHTML = `<div><strong>Email:</strong> ${m.Email||m.email||''}</div><div><strong>Phone:</strong> ${m.Phone||m.phone||''}</div>`;
      info.appendChild(h); info.appendChild(meta); info.appendChild(contact);
      card.appendChild(photo); card.appendChild(info);
      return card;
    }

    function renderMembers(list){
      membersGrid.innerHTML = '';
      if(!list.length) { setStatus('No members match your search'); return; }
      const frag = document.createDocumentFragment();
      list.forEach(m=> frag.appendChild(mkCard(m)));
      membersGrid.appendChild(frag);
      setStatus(`Showing ${list.length} members`);
    }

    function normalize(s){ return String(s||'').toLowerCase(); }

    function filterByName(q){
      if(!q) return members.slice();
      const nq = normalize(q);
      return members.filter(m=> normalize(m.Name||m['Name (EN)']||m['Name (TE)']||'').includes(nq));
    }

    // Debounced search
    let t = null;
    searchInput.addEventListener('input', (e)=>{
      clearTimeout(t);
      t = setTimeout(()=>{
        const val = e.target.value.trim();
        const filtered = filterByName(val);
        renderMembers(filtered);
      }, 250);
    });

    // Load sheet initially
    loadSheet();

  })();

  /* Scroll-to-top button: create, show on scroll, smooth scroll to top */
  (function(){
    // create button once
    let btn = document.querySelector('.scroll-top-btn');
    if(!btn){
      btn = document.createElement('button');
      btn.className = 'scroll-top-btn';
      btn.setAttribute('aria-label','Scroll to top');
      btn.setAttribute('title','Scroll to top');
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15l-6-6-6 6"/></svg>';
      document.body.appendChild(btn);
    }

    // show/hide logic
    let lastScroll = 0;
    function onScroll(){
      const y = window.scrollY || window.pageYOffset;
      if(y > 200){
        btn.classList.add('show');
      }else{
        btn.classList.remove('show');
      }
      lastScroll = y;
    }
    window.addEventListener('scroll', onScroll, {passive:true});

    // click handler: smooth scroll to top
    btn.addEventListener('click', function(){
      window.scrollTo({top:0,behavior:'smooth'});
      btn.blur();
    });

    // keyboard: Home key also scrolls to top
    window.addEventListener('keydown', function(e){ if(e.key === 'Home'){ window.scrollTo({top:0,behavior:'smooth'}); } });
    // initialize visibility
    onScroll();
  })();
});
