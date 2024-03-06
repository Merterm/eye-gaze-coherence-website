// Set to true if you want to save the data even if you reload the page.
window.saveDataAcrossSessions = true;

// heatmap configuration
const config = {
  radius: 25,
  maxOpacity: .5,
  minOpacity: 0,
  blur: .75
};

// Global variables
let heatmapInstance;

window.addEventListener('load', async function() {
  // Init webgazer
  if (!window.saveDataAcrossSessions) {
      var localstorageDataLabel = 'webgazerGlobalData';
      localforage.setItem(localstorageDataLabel, null);
      var localstorageSettingsLabel = 'webgazerGlobalSettings';
      localforage.setItem(localstorageSettingsLabel, null);
  }
  const webgazerInstance = await webgazer.setRegression('ridge') /* currently must set regression and tracker */
    .setTracker('TFFacemesh')
    .begin();
  
  // Turn off video
  webgazerInstance.showVideoPreview(true) /* shows all video previews */
    .showPredictionPoints(true); /* shows a square every 100 milliseconds where current prediction is */
  
    // Enable smoothing
  webgazerInstance.applyKalmanFilter(true); // Kalman Filter defaults to on.
  
  // Set up heatmap parts
//   setupHeatmap();
  webgazer.setGazeListener( eyeListener );
});

window.addEventListener('beforeunload', function() {
  if (window.saveDataAcrossSessions) {
      webgazer.end();
  } else {
      localforage.clear();
  }
});

// Trimmed down version of webgazer's click listener since the built-in one isn't exported
// Needed so we can have just the click listener without the move listener
// (The move listener was creating a lot of drift)
async function clickListener(event) {
  webgazer.recordScreenPosition(event.clientX, event.clientY, 'click'); // eventType[0] === 'click'
}

const imageElement = document.getElementById("content");
const textElement = document.getElementById("text");

// Replace these with your own image and text data
const images = [];
const texts = ["Caption: \n1- Score a small x at the end of each peach with a paring knife. ", 
                "Caption: \nTransfer to airtight container and freeze until firm.", 
                "Caption: \n4- Using paring knife, remove strips of loosened peel, starting at X on base of each peach.", 
                "Caption: \nthe pizza at restaurant is seen.", 
                "Caption: \nPeople are standing outside next to a food truck.", 
                "Caption: \nbeautiful chairs in a room.", 
                "Caption: \nA girl in the winter forest.", 
                "Caption: \nhow to spend a day", 
                "Caption: \nit was a beautiful day for him.", ""];
const instructions = "\n\n Relations: \n\ta) Text presents information about what’s in the image (Visible)\n\tb) Text contains the speaker’s reaction to the image (Subjective)\n\tc) Text describes a process and the image shows a moment in that process. (Action)\n\td) Text describes an action and the result of  the action is in the image. (Result)\n\te) Part of the description maps to a particular image region. (Illustration)\n\tf) Visual information often shows just one case of a generalization presented in accompanying text. (Exemplification)\n\tg) Text describes free-standing circumstances depicted in the image (Story)\n\th) Text talks about production and presentation of the image. When, where, how questions are answered. (Meta)";
for (let i = 0; i < 9; i++) {
  images.push({ src: `media/img${i+1}.png`, text: texts[i]+instructions });
}

const relations = ["Visible: Caption presents information about what is in the image", 
                    "Subjective: Caption is the caption writer's reaction or personal view about the image.", 
                    "Meta: Caption talks about production and presentation of the image. When, where, how questions are answered.",
                    "Story: Caption contains free-standing circumstances depicted in the image."];
for (let i = 9; i < 13; i++) {
  images.push({ src: `media/img${i+1}.png`, text: "Given the following definition, please come up with a caption for this image.\n\n"+relations[i-9]});
}

let currentImageIndex = 0;

function showPrevious() {
  if (currentImageIndex > 0) {
    currentImageIndex--;
  } else {
    currentImageIndex = images.length - 1;
  }
  updateImageAndText();
}

function showNext() {
  if (currentImageIndex < images.length - 1) {
    currentImageIndex++;
  } else {
    currentImageIndex = 0;
  }
  updateImageAndText();
}

function startRecording() {
    webgazer.resume();
    allCoordinates.push({x: -16, y: -16, value: -16}); // Add a dummy point to separate data
}

function stopRecording() {
    webgazer.pause();
    allCoordinates.push({x: -16, y: -16, value: -16}); // Add a dummy point to separate data
}

function updateImageAndText() {
  const imageData = images[currentImageIndex];
  imageElement.src = imageData.src;
  textElement.textContent = imageData.text;
}

// Add event listeners to buttons
const prevButton = document.getElementById("prevImage");
const nextButton = document.getElementById("nextImage");
const startButton = document.getElementById("startRecording");
const stopButton = document.getElementById("stopRecording");

prevButton.addEventListener("click", showPrevious);
nextButton.addEventListener("click", showNext);
startButton.addEventListener("click", startRecording);
stopButton.addEventListener("click", stopRecording);

updateImageAndText(); // Update initially to display the first image and text


// function setupHeatmap() {
//   // Don't use mousemove listener
//   webgazer.removeMouseEventListeners();
//   document.addEventListener('click', clickListener);

//   // Get the window size
//   let height = window.innerHeight;
//   let width = window.innerWidth;

//   // Set up the container
//   let container = document.getElementById('heatmapContainer');
//   container.style.height = `${height}px`;
//   container.style.width = `${width}px`;
//   config.container = container;

//   // create heatmap
//   heatmapInstance = h337.create(config);
// }

// buffer
let lastTime;
let lastGaze;
let allCoordinates = [];


async function eyeListener(data, clock) {
  // data is the gaze data, clock is the time since webgazer.begin()

  // Init if lastTime not set
  if(!lastTime) {
    lastTime = clock;
  }

  // In this we want to track how long a point was being looked at,
  // so we need to buffer where the gaze moves to and then on next move
  // we calculate how long the gaze stayed there.
  if(!!lastGaze) {
    if(!!lastGaze.x && !!lastGaze.y) {
      let duration = clock-lastTime;
      let point = {
        x: Math.floor(lastGaze.x),
        y: Math.floor(lastGaze.y),
        value: duration,
        imageLeft: Math.floor(imageElement.getBoundingClientRect().left),
        imageTop: Math.floor(imageElement.getBoundingClientRect().top),
        imageRight: Math.floor(imageElement.getBoundingClientRect().right),
        imageBottom: Math.floor(imageElement.getBoundingClientRect().bottom),
        textLeft: Math.floor(textElement.getBoundingClientRect().left),
        textTop: Math.floor(textElement.getBoundingClientRect().top),
        textRight: Math.floor(textElement.getBoundingClientRect().right),
        textBottom: Math.floor(textElement.getBoundingClientRect().bottom)
      }
    //   heatmapInstance.addData(point);
       allCoordinates.push(point);
    //    console.log(point);
    }
  }

  lastGaze = data;
  lastTime = clock;
}

function downloadCSV(data) {
    let csvContent = `X,Y, duration, ImageLeft, ImageTop, ImageRight, ImageBottom, TextLeft, TextTop, TextRight, TextBottom\n`;
    for (let i = 0; i < data.length; i++) {
      csvContent += `${data[i].x},${data[i].y},${data[i].value},${data[i].imageLeft},${data[i].imageTop},${data[i].imageRight},${data[i].imageBottom}, ${data[i].textLeft},${data[i].textTop},${data[i].textRight},${data[i].textBottom}\n`;
    }
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
  
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = "coordinates.csv";
    downloadLink.style.display = "none";
  
    document.body.appendChild(downloadLink);
    downloadLink.click();
  
    document.body.removeChild(downloadLink);
  
    URL.revokeObjectURL(url); // Clean up the temporary URL
}

// Call a function to download CSV after all data is collected
function downloadCoordinatesCSV() {
    if (allCoordinates.length > 0) {
      downloadCSV(allCoordinates); // Call the same download function
    } else {
      console.log("No coordinates data to download.");
    }
}

const downloadButton = document.getElementById("downloadCSV");
downloadButton.addEventListener("click", downloadCoordinatesCSV); // Add event listener to button

const calibrationButtonOFF = document.getElementById("calibrateOFF");
calibrationButtonOFF.addEventListener("click", function() {
  webgazer.showVideoPreview(false);
  webgazer.showPredictionPoints(false);
  webgazer.resume();
//   webgazer.clearData();
//   webgazer.setGazeListener( eyeListener );
//   webgazer.setGazeListener( eyeListener ).begin();
}); // Add event listener to button

const calibrationButtonON = document.getElementById("calibrateON");
calibrationButtonON.addEventListener("click", function() {
//   webgazer.showVideoPreview(true);
  webgazer.showPredictionPoints(true);
  webgazer.resume();
//   webgazer.clearData();
//   webgazer.setGazeListener( eyeListener );
//   webgazer.setGazeListener( eyeListener ).begin();
}); // Add event listener to button