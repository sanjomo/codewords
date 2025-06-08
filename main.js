// Satisfy the Google Maps API callback — we don't use this map visibly
window.initMap = function () {};

// Grid and styling setup
const gridServer = "https://grid.plus.codes/grid/";

const satelliteStyle = new ol.style.Style({
  stroke: new ol.style.Stroke({ color: "rgba(255,255,255,0.2)", width: 1 }),
});
const mapViewStyle = new ol.style.Style({
  stroke: new ol.style.Stroke({ color: "rgba(0,0,0,0.2)", width: 1 }),
});
const satelliteHighlightStyle = new ol.style.Style({
  fill: new ol.style.Fill({ color: "rgba(255,255,255,0.3)" }),
  stroke: new ol.style.Stroke({ color: "rgba(255,255,255,1)", width: 3 }),
});
const mapViewHighlightStyle = new ol.style.Style({
  fill: new ol.style.Fill({ color: "rgba(0,0,0,0.3)" }),
  stroke: new ol.style.Stroke({ color: "rgba(0,0,0,1)", width: 3 }),
});

// Layers
const olVectorLayer = new ol.layer.VectorTile({
  source: new ol.source.VectorTile({
    maxZoom: 21,
    format: new ol.format.GeoJSON(),
    url: gridServer + "wms/{z}/{x}/{y}.json?zoomadjust=2",
  }),
  style: satelliteStyle,
  visible: false,
});

const googleMapsSatelliteLayer = new ol.layer.Tile({
  source: new ol.source.XYZ({
    url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}&hl=en",
  }),
});

const googleMapsRoadmapLayer = new ol.layer.Tile({
  source: new ol.source.XYZ({
    url: "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&hl=en",
  }),
});

// Map
const olVectorMap = new ol.Map({
  target: "ol_vector_xyz",
  layers: [googleMapsSatelliteLayer, googleMapsRoadmapLayer, olVectorLayer],
  view: new ol.View({
    center: ol.proj.fromLonLat([8.54, 47.5]),
    zoom: 10,
    maxZoom: 21,
  }),
  controls: ol.control
    .defaults()
    .extend([
      new ol.control.FullScreen(),
      new ol.control.ZoomSlider(),
      new ol.control.ScaleLine(),
      new ol.control.OverviewMap(),
    ]),
});

// Auto-toggle grid layer on zoom
olVectorMap.getView().on("change:resolution", () => {
  olVectorLayer.setVisible(olVectorMap.getView().getZoom() >= 20);
});

// Highlight feature
const highlightLayer = new ol.layer.Vector({
  source: new ol.source.Vector(),
  map: olVectorMap,
  style: satelliteHighlightStyle,
});
let highlight = null;

function displayFeatureInfo(pixel) {
  const feature = olVectorMap.forEachFeatureAtPixel(pixel, (f) => f);
  if (feature !== highlight) {
    if (highlight) highlightLayer.getSource().removeFeature(highlight);
    if (feature) highlightLayer.getSource().addFeature(feature);
    highlight = feature;
  }
}

olVectorMap.on("pointermove", (e) => {
  if (!e.dragging) {
    displayFeatureInfo(olVectorMap.getEventPixel(e.originalEvent));
  }
});

// Handle clicks
const selectInteraction = new ol.interaction.Select({
  condition: ol.events.condition.click,
});
selectInteraction.on("select", (e) => {
  const feature = e.target.getFeatures().getArray()[0];
  if (feature) {
    const plusCode = feature.get("global_code");
    document.getElementById("ol_vector_code").textContent = plusCode;
    const decimal = base20ToDecimal(plusCode);
    const words = decimalToWords(decimal, wordList);
    document.getElementById(
      "loc_vector_code"
    ).textContent = `!!!${words[0]}.${words[1]}.${words[2]}`;
  }
});
olVectorMap.addInteraction(selectInteraction);

// Center on user location at load
getCurrentLocation();

// Utilities
function getCurrentLocation() {
  if (!navigator.geolocation) {
    console.error("Geolocation not supported.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const center = ol.proj.fromLonLat([
        position.coords.longitude,
        position.coords.latitude,
      ]);
      olVectorMap.getView().setCenter(center);
      olVectorMap.getView().setZoom(20);

      const marker = new ol.Feature({ geometry: new ol.geom.Point(center) });
      marker.setStyle(
        new ol.style.Style({
          image: new ol.style.Icon({
            src: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
            scale: 1,
          }),
        })
      );
      const vectorSource = new ol.source.Vector({ features: [marker] });
      const vectorLayer = new ol.layer.Vector({ source: vectorSource });
      olVectorMap.addLayer(vectorLayer);
    },
    (error) => console.error("Location error:", error)
  );
}

function switchMapType(type) {
  const isSatellite = type === "satellite";
  googleMapsSatelliteLayer.setVisible(isSatellite);
  googleMapsRoadmapLayer.setVisible(!isSatellite);
  olVectorLayer.setStyle(isSatellite ? satelliteStyle : mapViewStyle);
  highlightLayer.setStyle(
    isSatellite ? satelliteHighlightStyle : mapViewHighlightStyle
  );
}

function base20ToDecimal(code) {
  code = code.replace(/\+/g, "");
  const charMap = {
    2: 0,
    3: 1,
    4: 2,
    5: 3,
    6: 4,
    7: 5,
    8: 6,
    9: 7,
    C: 8,
    F: 9,
    G: 10,
    H: 11,
    J: 12,
    M: 13,
    P: 14,
    Q: 15,
    R: 16,
    V: 17,
    W: 18,
    X: 19,
  };
  let result = 0;
  for (let i = 0; i < code.length; i++) {
    const char = code[code.length - 1 - i];
    if (!(char in charMap)) {
      console.log(`Invalid character: ${char}`);
      return NaN;
    }
    result += charMap[char] * Math.pow(20, i);
  }
  return result;
}

function decimalToWords(decimal, wordList) {
  const t = 50000;
  if (wordList.length < t) throw new Error("Word list too short");
  const i = Math.floor(decimal / (t * t)) % t;
  const j = Math.floor(decimal / t) % t;
  const k = decimal % t;
  return [wordList[i], wordList[j], wordList[k]];
}
