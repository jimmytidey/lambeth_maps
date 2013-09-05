function lambeth_map(elem) {
    this.types = []; //Array to hold all the possible 'layers' of data
    this.currently_selected_type = 'all'; //Which 'layer' is currently  selected
    this.icons = [];
    
    //import config
    this.outline_url     = jQuery(elem).attr('data-map-outline-url');
    
    this.url             = jQuery(elem).attr('data-map-url'); //URL for geoJSON
    this.filterField     = jQuery(elem).attr('data-map-filter-on'); // Field used for dropdown/lookup
    this.zoom            = parseInt(jQuery(elem).attr('data-map-zoom')); //Map Zoom

    centre               = jQuery(elem).attr('data-map-centre').split(','); //Map Centre
    this.lat             = parseFloat(centre[0]);
    this.lng             = parseFloat(centre[1]);

    this.postcode_search = jQuery(elem).attr('data-map-postcode-search');
    this.searchType      = jQuery(elem).attr('data-map-search-type');

    this.elem = elem; //The HTML element we inserting into
    this.drawMap(); //Init the map                                   
}


lambeth_map.prototype.drawMap = function () {

    var maps_object = this;
    
    //add container for the map
    jQuery(this.elem).append("<div class='map_container'></div>");
    jQuery('.map_container', this.elem).append("<div class='leaflet_container'></div>");
    
    
    //do we need to render a control panel? 
    if (this.searchType || this.postcode_search) {

        //move the main map over 
        $('.leaflet_container', this.elem).addClass("map_with_controls");
        
        //add control panel 
        var html = '<div class="controls_container"></div>';
        jQuery(".map_container", maps_object.elem).append(html)
    }
    
    if (this.postcode_search) { 
        this.renderPostcodeLookup();
    }
    
    this.map = L.map($('.leaflet_container', this.elem)[0], {scrollWheelZoom: false}).setView([this.lat, this.lng], this.zoom);

    //using the cloudmade tiles
    L.tileLayer('http://{s}.tile.cloudmade.com/e7b61e61295a44a5b319ca0bd3150890/997/256/{z}/{x}/{y}.png').addTo(this.map);

    jQuery.getJSON(this.url + "?callback=?", function (data) {
        maps_object.data = data;
        
        //remove any null features 
        maps_object.data.features = maps_object.data.features.filter(function(e){return e}); 
        maps_object.discoverTypes();
    });


    //show the boundry of lambeth
    this.renderOutline();
};

lambeth_map.prototype.renderOutline = function () {
    var maps_object = this;
    
    this.outline_style = { //style the outline - may want to customise this
        "color": "#004a86",
        fillColor: "#fff",
        weight: 3,
        opacity: 1,
        fillOpacity: 0.3
    };
    

    //draws the outline of lambeth
    jQuery.getJSON(this.outline_url, function (data) {
        maps_object.outline = data;
        L.geoJson(maps_object.outline, {
            style: maps_object.outline_style
        }).addTo(maps_object.map);
    });
    

}

lambeth_map.prototype.discoverTypes = function () {
    
    //List every type of feature in the geo JSON
    var maps_object = this;

    jQuery.each(this.data.features, function (key, value) {
        
        if (value.properties[maps_object.filterField] && jQuery.inArray(value.properties[maps_object.filterField], maps_object.types) == -1) {

            var type_name = value.properties[maps_object.filterField];

            if (type_name !== '' && type_name !== null) {

                maps_object.types.push(type_name);

                //add new icon if one is available
                if (value.properties.uri_rendered) {

                    var CustomIcon = L.icon({
                        iconUrl: value.properties.uri_rendered,
                        iconSize: [39, 50],
                        iconAnchor: [19, 25],
                        popupAnchor: [0, -25]
                    });

                    var id = maps_object.icons.push(CustomIcon);

                    value.properties.icon_id = id - 1;

                    //now we need to see if any other pins should have this icon id  
                    for (i = 0; i < maps_object.data.features.length; i++) {

                        if (maps_object.data.features[i]) {
                            
                            if (maps_object.data.features[i].properties.uri_rendered == value.properties.uri_rendered) {
                                maps_object.data.features[i].properties.icon_id = id - 1;
                            }
                        }
                    }
                }
            }
        }

        if (maps_object.data.features.length - 1 == key) { //detect when we have looped through all the features
            
            maps_object.addPoints();  // add the points
            

            
            
            if (maps_object.searchType == 'drop-down') { //render the right UX
                maps_object.renderDropDown();
            } 
            
            else if (maps_object.searchType == 'auto-suggest') {
                maps_object.renderAutoSuggest();
            }
            
            else if (maps_object.searchType == 'key') {
                maps_object.renderKey();
            }
            
            
        }
    });
}

lambeth_map.prototype.addPoints = function () {

    var maps_object = this;

    //remove the existing stuff, if there is any
    if (typeof this.geoJsonLayer !== 'undefined') {
        this.map.removeLayer(maps_object.geoJsonLayer);
    }

    //add new stuff
    this.geoJsonLayer = L.geoJson(this.data, {
        onEachFeature: function (feature, layer) {


            if (typeof feature.properties.icon_id !== 'undefined') {
                layer.setIcon(maps_object.icons[feature.properties.icon_id]);
            }

            layer.bindPopup(feature.properties.name);
        },
        filter: function (feature) {

            if (maps_object.currently_selected_type == 'all') {
                return true;
            } else if (lambeth_map.htmlDecode(feature.properties[maps_object.filterField]) == maps_object.currently_selected_type) {
                return true;
            } else {
                return false;
            }
        }
    }).addTo(this.map);
}

lambeth_map.prototype.renderDropDown = function () {

    var maps_object = this;

    //add the selector HTML
    var html = '<select  class="type_selector"></selector>';
    jQuery('.controls_container', this.elem).append(html);

    jQuery('.type_selector', this.elem).append("<option value='all'>Select options here</option>");

    jQuery.each(this.types, function (key, value) {
        jQuery('.type_selector', this.elem).append("<option value='" + value + "'>" + value + "</option>");
    });

    //ensure there are no events stuck on this element
    jQuery('.type_selector', this.elem).unbind();
    jQuery('.type_selector', this.elem).change(function () {
        maps_object.currently_selected_type = jQuery(this).val();
        maps_object.addPoints();
    });
}

lambeth_map.prototype.renderAutoSuggest = function () {

    var maps_object = this;

    var html = '<div class="autosuggest">Where can I get rid of... </span><input type="text" class="type_suggest" /></div>';

    jQuery('.controls_container', this.elem).append(html);

    jQuery('.type_suggest', this.elem).autocomplete({
        source: maps_object.types,
        change: function (event, ui) {

            maps_object.currently_selected_type = ui.item.value;

            maps_object.addPoints();
        },
        select: function (event, ui) {
            maps_object.currently_selected_type = ui.item.value;

            maps_object.addPoints();
        }
    });
}

lambeth_map.prototype.renderKey = function(options) { 
    
    var maps_object = this;

    
    //add the selector HTML
    var html = '<div id="key_' + maps_object.elem_id + '"></div>';
    jQuery('#' + maps_object.elem_id).after(html);

    jQuery.each(this.types, function (key, value) {
        
        jQuery('#key_' + maps_object.elem_id).append("<div class='key_item' ><label for='checkbox_" + value + "'>" + value + "</label><input id='checkbox_"+value+ "' type='checkbox' value='" + value + "' /></div>");
    });
    
    //ensure there are no events stuck on this element
    jQuery('#type_selector_' + this.elem_id).unbind();
    jQuery('#type_selector_' + this.elem_id).change(function () {
        maps_object.currently_selected_type = jQuery(this).val();
        maps_object.addPoints();
    });
}

lambeth_map.prototype.renderPostcodeLookup = function () {
    console.log('rendering postcode lookup');
    
    var maps_object = this;

    var html = '<div class="postcode_lookup"><input type="text"   /><input type="button" class="postcode_submit" value="search"</div>';
    jQuery('.controls_container', this.elem).after(html);

    $('#postcode_button_' + this.elem_id).click(function () {
        var val = $('#postcode_lookup_' + maps_object.elem_id).val();
        
        maps_object.postcodeLookup(val);

    });

    $('#postcode_lookup_' + this.elem_id).keyup('enterKey', function (e) {
        if (e.keyCode === 13) {
            var val = $('#postcode_lookup_' + maps_object.elem_id).val();
            maps_object.postcodeLookup(val);
        }
    });
};



lambeth_map.prototype.postcodeLookup = function (postcode) {

    var maps_object = this;

    postcode = encodeURIComponent(postcode);

    jQuery.getJSON('http://nominatim.openstreetmap.org/search?format=json&q=' + postcode + '&countrycodes=gb&json_callback=?', function (data) {
        maps_object.map.setView([data[0].lat, data[0].lon], 15);
    });
};

lambeth_map.htmlDecode = function (input) {
    var e = document.createElement('div');
    e.innerHTML = input;
    return e.childNodes.length === 0 ? "" : e.childNodes[0].nodeValue;
}

jQuery(document).ready(function () {
    //Loop through all the maps elements and init a map
    lambeth_maps = [];
    jQuery('.lambeth_map').each(function (key, val) {
        lambeth_maps.push(new lambeth_map(val));
    });
});