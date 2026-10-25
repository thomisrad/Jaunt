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

    // Drawing the Photos from Cloudinary URLs!
    if (currentRide.photos && currentRide.photos.length > 0) {
      if (currentRide.photos.length === 1) {
        const img = document.createElement('img');
        img.src = currentRide.photos[0];
        img.className = 'ride-photo'; 
        card.appendChild(img);
      } else {
        const mediaContainer = document.createElement('div');
        const gallery = document.createElement('div');
        gallery.className = 'photo-gallery';
        
        const fullView = document.createElement('div');
        fullView.style.display = 'none'; 
        const fullImg = document.createElement('img');
        fullImg.className = 'ride-photo clickable-photo';
        
        const hintText = document.createElement('div');
        hintText.innerText = '🔄 Tap image to return to grid';
        hintText.style.fontSize = '12px';
        hintText.style.color = 'var(--text-muted)';
        hintText.style.textAlign = 'center';
        hintText.style.marginTop = '-10px';
        hintText.style.marginBottom = '15px';
        hintText.style.cursor = 'pointer';

        fullView.appendChild(fullImg);
        fullView.appendChild(hintText);
        
        currentRide.photos.forEach(function(photoUrl) {
          const img = document.createElement('img');
          img.src = photoUrl;
          img.className = 'gallery-photo clickable-photo';
          
          img.addEventListener('click', function() {
            gallery.style.display = 'none'; 
            fullImg.src = photoUrl; 
            fullView.style.display = 'block'; 
          });
          gallery.appendChild(img);
        });
        
        fullView.addEventListener('click', function() {
          fullView.style.display = 'none'; 
          gallery.style.display = 'grid'; 
        });
        
        mediaContainer.appendChild(gallery);
        mediaContainer.appendChild(fullView);
        card.appendChild(mediaContainer);
      }
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

    if (currentRide.lat && currentRide.lon) {
      const map = L.map(mapContainer, { zoomControl: false }).setView([currentRide.lat, currentRide.lon], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
      }).addTo(map);
      L.marker([currentRide.lat, currentRide.lon]).addTo(map);
    } else {
      mapContainer.style.display = 'none';
    }
  }
  
  totalMilesText.innerText = Math.round(total * 10) / 10;
}


// The Canvas Compressor Engine (still saves us massive internet bandwidth!)
function processImage(file) {
  return new Promise(function(resolve) {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    
    img.onload = function() {
      const size = Math.min(img.width, img.height);
      const startX = (img.width - size) / 2;
      const startY = (img.height - size) / 2;
      const canvas = document.createElement('canvas');
      const MAX_SIZE = 600; 
      const finalSize = Math.min(size, MAX_SIZE);
      canvas.width = finalSize;
      canvas.height = finalSize;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, startX, startY, size, size, 0, 0, finalSize, finalSize);
      
      const optimizedImage = canvas.toDataURL('image/jpeg', 0.7); 
      URL.revokeObjectURL(objectUrl);
      resolve(optimizedImage); 
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
// Priority: a photo's GPS > a spot you tap > your current location.
// ==========================================
let pickerMap = null;
let pickerMarker = null;
let pickedSpot = null;          // { lat, lon, source: 'photo' | 'tap' | 'current' }
let photoTime = null;           // Date the first photo was taken, if known
const locationStatus = document.getElementById('location-status');

function setSpot(lat, lon, source) {
  pickedSpot = { lat: lat, lon: lon, source: source };
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

  const messages = {
    photo: '📷 Location from your photo. Tap the map to change it.',
    tap: '📍 Pinned where you tapped.',
    current: '📍 Using where you are now. Tap the map if you rode somewhere else.'
  };
  locationStatus.innerText = messages[source];
}

function initPicker() {
  if (pickerMap) {
    pickerMap.invalidateSize();
    return;
  }
  pickerMap = L.map('picker-map', { zoomControl: false }).setView([39.5, -98.35], 3);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  }).addTo(pickerMap);

  pickerMap.on('click', function(e) {
    setSpot(e.latlng.lat, e.latlng.lng, 'tap');
  });

  useCurrentLocation();
}

function useCurrentLocation() {
  if (!navigator.geolocation) {
    locationStatus.innerText = 'Tap the map to mark where you rode.';
    return;
  }
  locationStatus.innerText = 'Finding your location…';
  navigator.geolocation.getCurrentPosition(function(position) {
    // Don't overwrite a spot from a photo or a tap that came in first
    if (!pickedSpot) {
      setSpot(position.coords.latitude, position.coords.longitude, 'current');
    }
  }, function() {
    if (!pickedSpot) locationStatus.innerText = 'Tap the map to mark where you rode.';
  }, { timeout: 8000, maximumAge: 60000, enableHighAccuracy: false });
}

// When photos are chosen, look inside them for GPS and the time they were taken
photoInput.addEventListener('change', async function() {
  photoTime = null;
  const files = Array.from(photoInput.files);
  for (const file of files) {
    try {
      const data = await exifr.parse(file, { gps: true, exif: true, tiff: true });
      if (!data) continue;
      if (!photoTime && data.DateTimeOriginal instanceof Date) {
        photoTime = data.DateTimeOriginal;
      }
      if (typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        if (!pickedSpot || pickedSpot.source !== 'tap') {
          setSpot(data.latitude, data.longitude, 'photo');
        }
        break;
      }
    } catch (error) {
      console.warn('Could not read photo info:', error);
    }
  }

  // Fill in the date from the photo if you haven't picked one
  if (photoTime && dateInput.value === '') {
    dateInput.value = toDateString(photoTime);
  }
  const source = pickedSpot ? pickedSpot.source : null;
  if (files.length > 0 && source !== 'photo' && source !== 'tap') {
    locationStatus.innerText = (pickedSpot ? '📍 No location in these photos, so using where you are now. ' : 'No location in these photos. ') + 'Tap the map to set it.';
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

  let city = null, temp = "--", lat = null, lon = null;
  if (pickedSpot) {
    lat = pickedSpot.lat;
    lon = pickedSpot.lon;
    loadingText.innerText = "Looking up place & weather...";
    // Only use the photo's hour if the photo is from the ride's date
    const time = (photoTime && toDateString(photoTime) === selectedDate) ? photoTime : null;
    const [cityResult, tempResult] = await Promise.allSettled([
      lookUpCity(lat, lon),
      lookUpTemp(lat, lon, selectedDate, time)
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
  photoTime = null;
  pickedSpot = null;
  if (pickerMarker) {
    pickerMap.removeLayer(pickerMarker);
    pickerMarker = null;
  }
  useCurrentLocation();
}

async function saveRideData(distance, selectedDate, notes, city, temp, lat, lon) {
  const files = Array.from(photoInput.files).slice(0, 9);

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
    if (files.length > 0) {
      const cloudPhotoUrls = [];

      for (let i = 0; i < files.length; i++) {
        loadingText.innerText = `Compressing photo ${i + 1} of ${files.length}...`;
        const optimizedImageBase64 = await processImage(files[i]);

        if (optimizedImageBase64) {
          loadingText.innerText = `Uploading photo ${i + 1} of ${files.length}...`;
          const cloudUrl = await uploadToCloudinary(optimizedImageBase64);
          if (cloudUrl) cloudPhotoUrls.push(cloudUrl);
        }
      }
      newRideEntry.photos = cloudPhotoUrls;
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
