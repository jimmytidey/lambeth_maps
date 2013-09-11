function lambeth_map(elem) {
    this.types          = []; //Array to hold all the possible 'layers' of data
    this.icons          = [];
    this.point_layers   = [];
    
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
    if (this.searchType || this.postcode_search === 'true') {

        //move the main map over 
        $('.leaflet_container', this.elem).addClass("map_with_controls");
        
        //add control panel 
        var html = '<div class="controls_container"></div>';
        jQuery(".map_container", maps_object.elem).append(html)
    }
    
    if (this.postcode_search === 'true') { 
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

        //this is new type never encountered before
        if(value.properties[maps_object.filterField] && jQuery.inArray(value.properties[maps_object.filterField], maps_object.types) == -1) {

            var type_name = value.properties[maps_object.filterField];

            if(type_name !== '' && type_name !== null) {

                var type_id = maps_object.types.push(type_name) - 1;

                value.properties.type_id = type_id;

                //add new icon if one is available
                if(value.properties.uri_rendered) {

                    value.properties.has_icon = true;

                    var CustomIcon = L.icon({
                        iconUrl: value.properties.uri_rendered,
                        iconSize: [39, 50],
                        iconAnchor: [19, 25],
                        popupAnchor: [0, -25]
                    });

                    maps_object.icons[type_id] = CustomIcon;

                }
            }
        }    

        //this type has been encountered before, we should assign the correct ID
        else {
            //assing ID
            type_id = 0;
            $.each(maps_object.types, function (type_key, type_val) {
                if(type_val === value.properties[maps_object.filterField]) {
                    type_id = type_key;
                    return false
                }
            });

            //also say whether the ID is set 
            value.properties.type_id = type_id;
            if(value.properties.uri_rendered) {
                value.properties.has_icon = true;
            }
        }

        //detect when we have looped through all the features
        if(maps_object.data.features.length - 1 == key) {

            //render the right UX
            if(maps_object.searchType == 'drop-down') {
                maps_object.renderDropDown();
            } else if(maps_object.searchType == 'auto-suggest') {
                maps_object.renderAutoSuggest();
            } else if(maps_object.searchType == 'key') {
                maps_object.renderKey();
            }

        }
    });
}

lambeth_map.prototype.addLayer = function(type_id) {

    var maps_object = this;
    
    //add new stuff
    this.point_layers[type_id] = L.geoJson(this.data, {
        onEachFeature: function (feature, leaflet_layer) { //layer here refering to leaflets internal concept of layer
            if (typeof feature.properties.has_icon) {
               if (leaflet_layer.setIcon) {
                   leaflet_layer.setIcon(maps_object.icons[feature.properties.type_id]);
                }
            }
            leaflet_layer.bindPopup(feature.properties.name);
        },
        filter: function (feature) {
            console.log(type_id); 
            console.log(feature.properties.type_id); 
            if (type_id === 'all') {
                return true;
            } else if (feature.properties.type_id == type_id) {
                return true;
            } else {
                return false;
            }
        }
    }).addTo(this.map);
}

lambeth_map.prototype.removeAllLayers = function() { 
    
    var maps_object = this;
    
    $.each(this.point_layers, function(key, val) { 
    
        if (typeof val !== 'undefined') {
            this.map.removeLayer(val);
        }
    });
}


lambeth_map.prototype.removeLayer = function(type_id) { 
    this.map.removeLayer(this.point_layers[type_id]);
}

lambeth_map.prototype.renderDropDown = function () {

    var maps_object = this;
        
    //add the selector HTML
    var html = '<select  class="type_selector"></selector>';
    jQuery('.controls_container', this.elem).append(html);

    jQuery('.type_selector', this.elem).append("<option value='all'>Select options here</option>");

    jQuery.each(this.types, function (key, value) {
        jQuery('.type_selector', this.elem).append("<option value='" + key + "'>" + value + "</option>");
    });

    //ensure there are no events stuck on this element
    jQuery('.type_selector', this.elem).unbind();
    jQuery('.type_selector', this.elem).change(function () {
         v = jQuery(this).val();
        maps_object.addLayer(layer_id);
    });
}

lambeth_map.prototype.renderAutoSuggest = function () {

    var maps_object = this;

    var html = '<div class="autosuggest">Where can I get rid of... </span><input type="text" class="type_suggest" /></div>';

    jQuery('.controls_container', this.elem).append(html);

    jQuery('.type_suggest', this.elem).autocomplete({
        source: maps_object.types,
        change: function (event, ui) {
            layer_id = ui.item.key; //dunno if this will work 
            maps_object.addLayer(layer_id);
        },
        select: function (event, ui) {
            layer_id = ui.item.key; //dunno if this will work 
            maps_object.addLayer(layer_id);
        }
    });
}

lambeth_map.prototype.renderKey = function(options) { 
    
    var maps_object = this;
        
    //add the selector HTML
    var html = '<div class="key"><div>';
    jQuery('.controls_container',  this.elem).append(html);

    jQuery.each(this.types, function (key, value) {
        var img_url = maps_object.icons[key].options.iconUrl; 
        jQuery('.key', maps_object.elem).append("<div class='key_item' ><img src='"+img_url+"' /><label for='checkbox_" + value + "'>" + value + "</label><input id='checkbox_"+value+ "' type='checkbox' value='" + key + "' /></div>");
    });
    
    //ensure there are no events stuck on this element
    jQuery('.key_item input',  this.elem).unbind();
    jQuery('.key_item input',  this.elem).change(function () {
        var key = jQuery(this).val();
        if($(this).prop('checked')) {         
            maps_object.addLayer(parseInt(key));
        }
        else { 
            maps_object.removeLayer(parseInt(key));
        }
    });
}

lambeth_map.prototype.renderPostcodeLookup = function () {
    
    var maps_object = this;

    var html = '<div class="postcode_lookup"><p>Show facilities near: <input type="text" placeholder="postcode or address"   /><input type="button" class="postcode_submit" value="search"</div>';
    
    jQuery('.controls_container', this.elem).append(html);
    
    lambeth_map.addPlaceholder();

    //TODO remove elem_id
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


jQuery(document).ready(function () {
    //Loop through all the maps elements and init a map
    lambeth_maps = [];
    jQuery('.lambeth_map').each(function (key, val) {
        lambeth_maps.push(new lambeth_map(val));
    });
});

//UTILITY FUNCTION 
lambeth_map.htmlDecode = function (input) {
    var e = document.createElement('div');
    e.innerHTML = input;
    return e.childNodes.length === 0 ? "" : e.childNodes[0].nodeValue;
}

lambeth_map.addPlaceholder = function() {
    if(!Modernizr.input.placeholder){

    	$('[placeholder]').focus(function() {
    	  var input = $(this);
    	  if (input.val() == input.attr('placeholder')) {
    		input.val('');
    		input.removeClass('placeholder');
    	  }
    	}).blur(function() {
    	  var input = $(this);
    	  if (input.val() == '' || input.val() == input.attr('placeholder')) {
    		input.addClass('placeholder');
    		input.val(input.attr('placeholder'));
    	  }
    	}).blur();
    	$('[placeholder]').parents('form').submit(function() {
    	  $(this).find('[placeholder]').each(function() {
    		var input = $(this);
    		if (input.val() == input.attr('placeholder')) {
    		  input.val('');
    		}
    	  })
    	});
    }
}
