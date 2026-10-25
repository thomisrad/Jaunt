import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, getDoc, query, orderBy, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

// ==========================================
// CLOUD KEYS (safe to be public — the security rules protect the data)
// ==========================================
const CLOUDINARY_CLOUD_NAME = "dtfhbvjkr"; 
const CLOUDINARY_UPLOAD_PRESET = "f4qtscfi"; 

// Paste your entire Firebase config object here:
const firebaseConfig = {
  apiKey: "AIzaSyDIGTj_AJqV5A5bND8eLq11KTyjHIo-yTo",
  authDomain: "jauntyroad.firebaseapp.com",
  projectId: "jauntyroad",
  storageBucket: "jauntyroad.firebasestorage.app",
  messagingSenderId: "338208080713",
  appId: "1:338208080713:web:134ce339ea7fec599f9098",
  measurementId: "G-KQF2LF76WF"
};
// ==========================================

// Initialize the Internet Databases
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const themeToggle = document.getElementById('theme-toggle');
if (localStorage.getItem('theme') === 'dark') {
  document.body.classList.add('dark-theme');
  themeToggle.innerText = '☀️';
}
themeToggle.addEventListener('click', function() {
  document.body.classList.toggle('dark-theme');
  if (document.body.classList.contains('dark-theme')) {
    themeToggle.innerText = '☀️';
    localStorage.setItem('theme', 'dark');
  } else {
    themeToggle.innerText = '🌙';
    localStorage.setItem('theme', 'light');
  }
});

const logButton = document.getElementById('log-button');
const loadingText = document.getElementById('loading-text');
const distanceInput = document.getElementById('distance-input');
const dateInput = document.getElementById('date-input');
const photoInput = document.getElementById('photo-input');
const notesInput = document.getElementById('notes-input'); 
const rideList = document.getElementById('ride-list');
const totalMilesText = document.getElementById('total-miles');

// ==========================================
// SIGN-IN & INVITE CHECK
// Who's allowed in lives in Firestore at config/access:
//   owner:   your Google email (can post and delete)
//   viewers: list of invited emails (can only view)
// The security rules (firestore.rules) enforce this on Google's side,
// so hiding buttons here is just for a tidy screen.
// ==========================================
const views = {
  loading: document.getElementById('loading-view'),
  signin: document.getElementById('signin-view'),
  denied: document.getElementById('denied-view'),
  app: document.getElementById('app-view')
};
const ownerForm = document.getElementById('owner-form');
let isOwner = false;

function showView(name) {
  for (const key in views) {
    views[key].classList.toggle('hidden', key !== name);
  }
}

document.getElementById('signin-button').addEventListener('click', async function() {
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (error) {
    console.error("Sign-in failed:", error);
    if (error.code !== 'auth/popup-closed-by-user') {
      alert("Sign-in didn't work. If you're opening this as a local file, it needs to be on the web (GitHub Pages) for Google sign-in.");
    }
  }
});

document.querySelectorAll('.signout-button').forEach(function(button) {
  button.addEventListener('click', function() { signOut(auth); });
});

onAuthStateChanged(auth, async function(user) {
  if (!user) {
    isOwner = false;
    showView('signin');
    return;
  }

  try {
    // If you're not invited, the security rules refuse this read.
    const accessDoc = await getDoc(doc(db, "config", "access"));
    if (!accessDoc.exists()) {
      throw { code: 'permission-denied' };
    }
    isOwner = accessDoc.data().owner === user.email;
  } catch (error) {
    console.error("Access check failed:", error);
    document.getElementById('denied-email').innerText = user.email;
    showView('denied');
    return;
  }

  document.getElementById('user-email').innerText = user.email + (isOwner ? ' (owner)' : '');
  ownerForm.classList.toggle('hidden', !isOwner);
  showView('app');
  if (isOwner) initPicker();
  fetchRidesFromCloud();
});

let rides = []; 

// --- NEW: Download Rides from Firebase ---
async function fetchRidesFromCloud() {
  rideList.innerHTML = '<p style="text-align:center; color:#64748b;">Loading cloud data...</p>';
  try {
    const q = query(collection(db, "rides"), orderBy("id", "desc"));
    const querySnapshot = await getDocs(q);
    rides = [];
    querySnapshot.forEach((document) => {
      // We save the Firebase Document ID so we know which one to delete later!
      rides.push({ firebaseId: document.id, ...document.data() }); 
    });
    updateScreen();
  } catch (error) {
    console.error("Error fetching from Firebase:", error);
    rideList.innerHTML = '<p style="text-align:center; color:#ef4444;">Failed to connect to cloud database.</p>';
  }
}

function updateScreen() {
  rideList.innerHTML = '';
  let total = 0;

  // We loop normally now, because Firebase sorted them for us!
  for (let i = 0; i < rides.length; i++) {
    const currentRide = rides[i];
    total = total + currentRide.distance;
    
    const card = document.createElement('div');
    card.className = 'ride-card';

    const header = document.createElement('div');
    header.className = 'ride-header';

    const dateText = document.createElement('div');
    dateText.className = 'ride-date';
    dateText.innerText = currentRide.date;
    
    const metaText = document.createElement('div');
    metaText.className = 'ride-meta';
    if (currentRide.city) {
      const hasTemp = currentRide.temp !== undefined && currentRide.temp !== null && currentRide.temp !== "--";
      metaText.innerText = hasTemp ? `${currentRide.city} • ${currentRide.temp}°F` : currentRide.city;
    } else {
      metaText.innerText = "No location data";
    }

    header.appendChild(dateText);
    header.appendChild(metaText);
    card.appendChild(header);

    if (currentRide.notes && currentRide.notes.trim() !== "") {
      const notesText = document.createElement('div');
      notesText.className = 'ride-notes';
      notesText.innerText = currentRide.notes; 
      card.appendChild(notesText);
    }

    const mapContainer = document.createElement('div');
    mapContainer.className = 'ride-map';
    card.appendChild(mapContainer);

    const footer = document.createElement('div');
    footer.className = 'ride-footer';
    
    const distanceText = document.createElement('span');
    distanceText.innerHTML = `<strong>${currentRide.distance}</strong> miles`;
    footer.appendChild(distanceText);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerText = 'Delete';
    
    // --- NEW: Delete from Firebase ---
    deleteBtn.addEventListener('click', async function() {
      if (!confirm("Delete this ride? This can't be undone.")) return;
      deleteBtn.innerText = "Deleting...";
      try {
        await deleteDoc(doc(db, "rides", currentRide.firebaseId));
        fetchRidesFromCloud(); // Refresh the list
      } catch (e) {
        console.error("Delete failed", e);
        alert("Failed to delete from cloud.");
      }
    });
    
    if (isOwner) {
      footer.appendChild(deleteBtn);
    }
    card.appendChild(footer);
    
    rideList.appendChild(card);

    renderRideMedia(mapContainer, currentRide);
  }
  
  totalMilesText.innerText = Math.round(total * 10) / 10;
}


// ==========================================
// PHOTO MAPS
// Each photo is saved as { url, lat, lon, time }.
// Older rides saved plain photo links; those get placed at the ride's pin.
// ==========================================
function normalizePhotos(ride) {
  const list = (ride.photos || []).map(function(p) {
    if (typeof p === 'string') {
      return { url: p, lat: ride.lat ?? null, lon: ride.lon ?? null, time: null };
    }
    return p;
  });
  // Oldest first, so the numbers follow the ride. Photos without a time keep their order.
  return list
    .map(function(p, i) { return { p: p, i: i }; })
    .sort(function(x, y) {
      if (x.p.time && y.p.time) return x.p.time - y.p.time;
      return x.i - y.i;
    })
    .map(function(x) { return x.p; });
}

function hasSpot(p) {
  return typeof p.lat === 'number' && typeof p.lon === 'number';
}

// Ask Cloudinary for a small square version of a photo (saves data on the map)
function thumbUrl(url, size) {
  if (url.includes('/image/upload/')) {
    return url.replace('/image/upload/', `/image/upload/c_fill,g_auto,w_${size},h_${size}/`);
  }
  return url;
}

function photoIcon(src, number, extraClass, nudge) {
  const shift = (nudge || 0) * 22; // fan out photos taken at the same spot
  return L.divIcon({
    className: 'photo-pin ' + (extraClass || ''),
    html: `<img src="${src}" alt=""><span>${number}</span>`,
    iconSize: [46, 46],
    iconAnchor: [23 - shift, 23 + shift]
  });
}

// How many photos so far sit at (nearly) this spot — used to fan them out
function makeNudger() {
  const seen = {};
  return function(lat, lon) {
    const key = lat.toFixed(4) + ',' + lon.toFixed(4);
    seen[key] = (seen[key] || 0) + 1;
    return seen[key] - 1;
  };
}

function addTiles(map) {
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
}

function renderRideMedia(mapContainer, ride) {
  const photos = normalizePhotos(ride);
  const placed = photos.filter(hasSpot);
  const unplaced = photos.filter(function(p) { return !hasSpot(p); });

  if (placed.length > 0) {
    const map = L.map(mapContainer, { zoomControl: false });
    addTiles(map);
    const nudge = makeNudger();
    const points = [];
    placed.forEach(function(p) {
      const n = photos.indexOf(p);
      points.push([p.lat, p.lon]);
      L.marker([p.lat, p.lon], { icon: photoIcon(thumbUrl(p.url, 96), n + 1, '', nudge(p.lat, p.lon)) })
        .addTo(map)
        .on('click', function() { openLightbox(photos, n); });
    });
    if (points.length > 1) {
      L.polyline(points, { color: '#10b981', weight: 3, dashArray: '6 8', opacity: 0.9 }).addTo(map);
      map.fitBounds(points, { padding: [35, 35], maxZoom: 15 });
    } else {
      map.setView(points[0], 14);
    }
  } else if (typeof ride.lat === 'number' && typeof ride.lon === 'number') {
    const map = L.map(mapContainer, { zoomControl: false }).setView([ride.lat, ride.lon], 13);
    addTiles(map);
    L.marker([ride.lat, ride.lon]).addTo(map);
  } else {
    mapContainer.style.display = 'none';
  }

  // Photos with no location at all still need to be viewable
  if (unplaced.length > 0) {
    const strip = document.createElement('div');
    strip.className = 'photo-strip';
    unplaced.forEach(function(p) {
      const img = document.createElement('img');
      img.src = thumbUrl(p.url, 120);
      img.alt = '';
      img.addEventListener('click', function() { openLightbox(photos, photos.indexOf(p)); });
      strip.appendChild(img);
    });
    mapContainer.after(strip);
  }
}

// ---------- Full-size photo viewer ----------
const lightbox = document.createElement('div');
lightbox.className = 'lightbox hidden';
lightbox.innerHTML = `
  <button class="lb-close" aria-label="Close">✕</button>
  <button class="lb-prev" aria-label="Previous photo">‹</button>
  <img class="lb-img" alt="">
  <button class="lb-next" aria-label="Next photo">›</button>
  <div class="lb-count"></div>`;
document.body.appendChild(lightbox);
let lbPhotos = [];
let lbIndex = 0;

function showLightboxPhoto() {
  lightbox.querySelector('.lb-img').src = lbPhotos[lbIndex].url;
  lightbox.querySelector('.lb-count').innerText = `${lbIndex + 1} / ${lbPhotos.length}`;
  const multiple = lbPhotos.length > 1;
  lightbox.querySelector('.lb-prev').classList.toggle('hidden', !multiple);
  lightbox.querySelector('.lb-next').classList.toggle('hidden', !multiple);
}
function openLightbox(photos, index) {
  lbPhotos = photos;
  lbIndex = index;
  showLightboxPhoto();
  lightbox.classList.remove('hidden');
}
function closeLightbox() { lightbox.classList.add('hidden'); }
function stepLightbox(delta) {
  lbIndex = (lbIndex + delta + lbPhotos.length) % lbPhotos.length;
  showLightboxPhoto();
}
lightbox.querySelector('.lb-close').addEventListener('click', closeLightbox);
lightbox.querySelector('.lb-prev').addEventListener('click', function(e) { e.stopPropagation(); stepLightbox(-1); });
lightbox.querySelector('.lb-next').addEventListener('click', function(e) { e.stopPropagation(); stepLightbox(1); });
lightbox.addEventListener('click', function(e) { if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', function(e) {
  if (lightbox.classList.contains('hidden')) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft' && lbPhotos.length > 1) stepLightbox(-1);
  if (e.key === 'ArrowRight' && lbPhotos.length > 1) stepLightbox(1);
});

// Shrinks photos before upload (long side max 1600px) — keeps the whole picture
function processImage(file) {
  return new Promise(function(resolve) {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = function() {
      const MAX_SIDE = 1600;
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };

    img.onerror = function() {
      URL.revokeObjectURL(objectUrl);
      resolve(null);
    };
    img.src = objectUrl;
  });
}

// --- NEW: The Cloudinary Uploader ---
async function uploadToCloudinary(base64Image) {
  const url = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  const formData = new FormData();
  formData.append('file', base64Image);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(url, { method: 'POST', body: formData });
  const data = await response.json();
  return data.secure_url; // This gives us a beautiful, lightweight internet URL!
}

// ==========================================
// WHERE & WHEN THE RIDE HAPPENED
// With photos: each photo sits on the map where it was taken (drag to fix).
// Without photos: one pin — your current spot, or wherever you tap.
// ==========================================
let pickerMap = null;
let pickerMarker = null;        // the single pin, used when there are no photos
let pickedSpot = null;          // { lat, lon, source: 'tap' | 'current' }
let pendingPhotos = [];         // [{ file, preview, lat, lon, time, fromPhoto, marker }]
const locationStatus = document.getElementById('location-status');

function setSpot(lat, lon, source) {
  pickedSpot = { lat: lat, lon: lon, source: source };
  if (pendingPhotos.length > 0) return; // photos are in charge of the map
  if (!pickerMarker) {
    pickerMarker = L.marker([lat, lon], { draggable: true }).addTo(pickerMap);
    pickerMarker.on('dragend', function() {
      const pos = pickerMarker.getLatLng();
      setSpot(pos.lat, pos.lng, 'tap');
    });
  } else {
    pickerMarker.setLatLng([lat, lon]);
  }
  if (source !== 'tap') pickerMap.setView([lat, lon], 13);
  locationStatus.innerText = source === 'tap'
    ? '📍 Pinned where you tapped.'
    : '📍 Using where you are now. Tap the map if you rode somewhere else.';
}

function initPicker() {
  if (pickerMap) {
    pickerMap.invalidateSize();
    return;
  }
  pickerMap = L.map('picker-map', { zoomControl: false }).setView([39.5, -98.35], 3);
  addTiles(pickerMap);

  pickerMap.on('click', function(e) {
    if (pendingPhotos.length === 0) {
      setSpot(e.latlng.lat, e.latlng.lng, 'tap');
      return;
    }
    // With photos: a tap places the next photo that still needs a spot
    const next = pendingPhotos.find(function(p) { return p.needsSpot; });
    if (next) {
      next.lat = e.latlng.lat;
      next.lon = e.latlng.lng;
      next.needsSpot = false;
      next.marker.setLatLng(e.latlng);
      refreshPhotoMarkers();
    }
  });

  useCurrentLocation();
}

function useCurrentLocation() {
  if (!navigator.geolocation) {
    if (pendingPhotos.length === 0) locationStatus.innerText = 'Tap the map to mark where you rode.';
    return;
  }
  if (pendingPhotos.length === 0) locationStatus.innerText = 'Finding your location…';
  navigator.geolocation.getCurrentPosition(function(position) {
    if (!pickedSpot) {
      setSpot(position.coords.latitude, position.coords.longitude, 'current');
    }
  }, function() {
    if (!pickedSpot && pendingPhotos.length === 0) locationStatus.innerText = 'Tap the map to mark where you rode.';
  }, { timeout: 8000, maximumAge: 60000, enableHighAccuracy: false });
}

function clearPendingPhotos() {
  pendingPhotos.forEach(function(p) {
    if (p.marker) pickerMap.removeLayer(p.marker);
    URL.revokeObjectURL(p.preview);
  });
  pendingPhotos = [];
}

// Redraw numbers/outlines and update the hint under the map
function refreshPhotoMarkers() {
  const nudge = makeNudger();
  pendingPhotos.forEach(function(p, i) {
    p.marker.setIcon(photoIcon(p.preview, i + 1, p.needsSpot ? 'needs-spot' : '', nudge(p.lat, p.lon)));
  });
  const missing = pendingPhotos.filter(function(p) { return p.needsSpot; }).length;
  if (missing === 0) {
    locationStatus.innerText = '📷 Each photo is pinned where it was taken. Drag any to adjust.';
  } else {
    locationStatus.innerText = `📷 ${missing} photo${missing > 1 ? 's' : ''} had no location (dashed outline). ` +
      'Tap the map to place them in order, or drag them.';
  }
}

// When photos are chosen: read each one's GPS and time, and put it on the map
photoInput.addEventListener('change', async function() {
  if (pickerMarker) {
    pickerMap.removeLayer(pickerMarker);
    pickerMarker = null;
  }
  clearPendingPhotos();

  const files = Array.from(photoInput.files).slice(0, 9);
  if (files.length === 0) {
    if (pickedSpot) setSpot(pickedSpot.lat, pickedSpot.lon, pickedSpot.source);
    return;
  }
  locationStatus.innerText = 'Reading photos…';

  for (const file of files) {
    let data = null;
    try {
      data = await exifr.parse(file, { gps: true, exif: true, tiff: true });
    } catch (error) {
      console.warn('Could not read photo info:', error);
    }
    const fromPhoto = !!(data && typeof data.latitude === 'number' && typeof data.longitude === 'number');
    pendingPhotos.push({
      file: file,
      preview: URL.createObjectURL(file),
      lat: fromPhoto ? data.latitude : null,
      lon: fromPhoto ? data.longitude : null,
      time: (data && data.DateTimeOriginal instanceof Date) ? data.DateTimeOriginal : null,
      needsSpot: !fromPhoto
    });
  }

  // Oldest first so numbers follow the ride
  pendingPhotos.sort(function(x, y) {
    if (x.time && y.time) return x.time - y.time;
    return 0;
  });

  // Photos without a location start at your current spot (or the map's center)
  const fallback = pickedSpot
    ? [pickedSpot.lat, pickedSpot.lon]
    : [pickerMap.getCenter().lat, pickerMap.getCenter().lng];

  pendingPhotos.forEach(function(p) {
    if (p.needsSpot) {
      p.lat = fallback[0];
      p.lon = fallback[1];
    }
    p.marker = L.marker([p.lat, p.lon], { draggable: true, icon: photoIcon(p.preview, 1) }).addTo(pickerMap);
    p.marker.on('dragend', function() {
      const pos = p.marker.getLatLng();
      p.lat = pos.lat;
      p.lon = pos.lng;
      p.needsSpot = false;
      refreshPhotoMarkers();
    });
  });
  refreshPhotoMarkers();

  const points = pendingPhotos.map(function(p) { return [p.lat, p.lon]; });
  if (points.length > 1) {
    pickerMap.fitBounds(points, { padding: [35, 35], maxZoom: 15 });
  } else {
    pickerMap.setView(points[0], 14);
  }

  // Fill in the date from the first photo if you haven't picked one
  const firstTime = pendingPhotos.find(function(p) { return p.time; });
  if (firstTime && dateInput.value === '') {
    dateInput.value = toDateString(firstTime.time);
  }
});

function toDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// City name for a spot (OpenStreetMap)
async function lookUpCity(lat, lon) {
  const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&lat=${lat}&lon=${lon}`);
  const data = await response.json();
  const a = data.address || {};
  return a.city || a.town || a.village || a.hamlet || a.county || "Unknown place";
}

// Temperature for the ride's date and place (Open-Meteo, free, no key).
// If we know the hour (from a photo), use that hour; otherwise the day's high.
async function lookUpTemp(lat, lon, dateString, time) {
  const params = `latitude=${lat}&longitude=${lon}&start_date=${dateString}&end_date=${dateString}` +
    `&hourly=temperature_2m&daily=temperature_2m_max&temperature_unit=fahrenheit&timezone=auto`;

  // Recent and upcoming days live in the forecast service; older days in the archive.
  const urls = [
    `https://api.open-meteo.com/v1/forecast?${params}`,
    `https://archive-api.open-meteo.com/v1/archive?${params}`
  ];

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();

      if (time && data.hourly && data.hourly.temperature_2m) {
        const hourTemp = data.hourly.temperature_2m[time.getHours()];
        if (typeof hourTemp === 'number') return Math.round(hourTemp);
      }
      if (data.daily && typeof data.daily.temperature_2m_max?.[0] === 'number') {
        return Math.round(data.daily.temperature_2m_max[0]);
      }
    } catch (error) {
      console.warn('Weather lookup failed:', url, error);
    }
  }
  return "--";
}

logButton.addEventListener('click', async function() {
  const distance = Number(distanceInput.value);
  const selectedDate = dateInput.value;
  const notes = notesInput.value;

  if (!(distance > 0) || selectedDate === "") {
    alert("Please enter a valid distance AND select a date!");
    return;
  }

  logButton.disabled = true;
  logButton.innerText = "Logging...";
  loadingText.classList.remove("hidden");

  // The ride's main spot: first photo if there are photos, otherwise the pin
  const firstPhoto = pendingPhotos[0];
  const spot = firstPhoto ? { lat: firstPhoto.lat, lon: firstPhoto.lon } : pickedSpot;
  const timed = pendingPhotos.find(function(p) { return p.time && toDateString(p.time) === selectedDate; });

  let city = null, temp = "--", lat = null, lon = null;
  if (spot) {
    lat = spot.lat;
    lon = spot.lon;
    loadingText.innerText = "Looking up place & weather...";
    const [cityResult, tempResult] = await Promise.allSettled([
      lookUpCity(lat, lon),
      lookUpTemp(lat, lon, selectedDate, timed ? timed.time : null)
    ]);
    city = cityResult.status === 'fulfilled' ? cityResult.value : "Unknown place";
    temp = tempResult.status === 'fulfilled' ? tempResult.value : "--";
  }

  saveRideData(distance, selectedDate, notes, city, temp, lat, lon);
});

function resetForm() {
  distanceInput.value = '';
  notesInput.value = '';
  photoInput.value = '';
  dateInput.value = '';
  clearPendingPhotos();
  pickedSpot = null;
  if (pickerMarker) {
    pickerMap.removeLayer(pickerMarker);
    pickerMarker = null;
  }
  useCurrentLocation();
}

async function saveRideData(distance, selectedDate, notes, city, temp, lat, lon) {
  const newRideEntry = {
    id: Date.now(),
    date: selectedDate,
    distance: distance,
    notes: notes,
    city: city,
    temp: temp,
    lat: lat,
    lon: lon,
    photos: []
  };

  try {
    for (let i = 0; i < pendingPhotos.length; i++) {
      const p = pendingPhotos[i];
      loadingText.innerText = `Preparing photo ${i + 1} of ${pendingPhotos.length}...`;
      const optimized = await processImage(p.file);
      if (!optimized) continue;

      loadingText.innerText = `Uploading photo ${i + 1} of ${pendingPhotos.length}...`;
      const cloudUrl = await uploadToCloudinary(optimized);
      if (cloudUrl) {
        newRideEntry.photos.push({
          url: cloudUrl,
          lat: p.lat,
          lon: p.lon,
          time: p.time ? p.time.getTime() : null
        });
      }
    }

    loadingText.innerText = "Saving...";
    await addDoc(collection(db, "rides"), newRideEntry);

    resetForm();
    fetchRidesFromCloud();

  } catch (error) {
    console.error("Cloud Save failed:", error);
    alert("Error saving the ride. Check the console for details.");
  } finally {
    logButton.disabled = false;
    logButton.innerText = "Log this Ride!";
    loadingText.classList.add("hidden");
  }
}
