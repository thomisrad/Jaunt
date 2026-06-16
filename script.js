import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 1. YOUR CLOUD KEYS (FILL THESE IN!)
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
    if (currentRide.city && currentRide.temp) {
      metaText.innerText = `${currentRide.city} • ${currentRide.temp}°F`;
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
      deleteBtn.innerText = "Deleting...";
      try {
        await deleteDoc(doc(db, "rides", currentRide.firebaseId));
        fetchRidesFromCloud(); // Refresh the list
      } catch (e) {
        console.error("Delete failed", e);
        alert("Failed to delete from cloud.");
      }
    });
    
    footer.appendChild(deleteBtn);
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
  
  totalMilesText.innerText = total;
}

// Fetch the rides as soon as the app loads!
fetchRidesFromCloud();

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

logButton.addEventListener('click', async function() {
  const distance = Number(distanceInput.value);
  const selectedDate = dateInput.value;
  const notes = notesInput.value; 

  if (distance > 0 && selectedDate !== "") {
    logButton.disabled = true;
    logButton.innerText = "Logging...";
    loadingText.style.display = "block";
    loadingText.innerText = "Fetching location...";

    const geoOptions = { timeout: 5000, maximumAge: 0, enableHighAccuracy: false };

    navigator.geolocation.getCurrentPosition(async function(position) {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;

      try {
        const cityResponse = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
        const cityData = await cityResponse.json();
        const city = cityData.address.city || cityData.address.town || cityData.address.village || "Unknown City";

        const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=fahrenheit`);
        const weatherData = await weatherResponse.json();
        const temp = Math.round(weatherData.current_weather.temperature);

        saveRideData(distance, selectedDate, notes, city, temp, lat, lon);
      } catch (error) {
        saveRideData(distance, selectedDate, notes, "Location Found", "--", lat, lon);
      }
    }, function(error) {
      saveRideData(distance, selectedDate, notes, "No GPS", "--", null, null);
    }, geoOptions); 

  } else {
    alert("Please enter a valid distance AND select a date!");
  }
});

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
          loadingText.innerText = `Uploading photo ${i + 1} to Cloudinary...`;
          // Upload the tiny compressed image to the internet vault
          const cloudUrl = await uploadToCloudinary(optimizedImageBase64);
          cloudPhotoUrls.push(cloudUrl);
        }
      }
      newRideEntry.photos = cloudPhotoUrls;
    }
    
    loadingText.innerText = "Saving to Firebase...";
    
    // --- NEW: Beaming the data directly to Google's servers ---
    await addDoc(collection(db, "rides"), newRideEntry);

    // Reset the UI and redownload everything from the cloud
    distanceInput.value = '';
    notesInput.value = '';
    photoInput.value = '';
    dateInput.value = '';
    logButton.disabled = false;
    logButton.innerText = "Log this Ride!";
    loadingText.style.display = "none";
    
    fetchRidesFromCloud();

  } catch (error) {
    console.error("Cloud Save failed:", error);
    alert("Error saving to the internet. Check the console for details.");
    logButton.disabled = false;
    logButton.innerText = "Log this Ride!";
    loadingText.style.display = "none";
  }
}
