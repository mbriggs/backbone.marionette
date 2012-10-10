// Marionette.View
// ---------------

// The core view type that other Marionette views extend from.
Marionette.View = Backbone.View.extend({

  constructor: function(){
    _.bindAll(this, "render");
    Marionette.addEventBinder(this);

    Backbone.View.protosourceType.constructor.apply(this, arguments);

    this.bindBackboneEntityTo(this.model, this.modelEvents);
    this.bindBackboneEntityTo(this.collection, this.collectionEvents);

    this.bindTo(this, "show", this.onShowCalled, this);
  },

  // import the "triggerMethod" to trigger events with corresponding
  // methods if the method exists
  triggerMethod: Marionette.triggerMethod,

  // Get the template for this view
  // instance. You can set a `template` attribute in the view
  // definition or pass a `template: "whatever"` parameter in
  // to the constructor options.
  getTemplate: function(){
    var template;

    // Get the template from `this.options.template` or
    // `this.template`. The `options` takes precedence.
    if (this.options && this.options.template){
      template = this.options.template;
    } else {
      template = this.template;
    }

    return template;
  },

  // Mix in template helper methods. Looks for a
  // `templateHelpers` attribute, which can either be an
  // object literal, or a function that returns an object
  // literal. All methods and attributes from this object
  // are copies to the object passed in.
  mixinTemplateHelpers: function(target){
    target = target || {};
    var templateHelpers = this.templateHelpers;
    if (_.isFunction(templateHelpers)){
      templateHelpers = templateHelpers.call(this);
    }
    return _.extend(target, templateHelpers);
  },

  // Configure `triggers` to forward DOM events to view
  // events. `triggers: {"click .foo": "do:foo"}`
  configureTriggers: function(){
    if (!this.triggers) { return; }

    var triggers = this.triggers;
    var that = this;
    var triggerEvents = {};

    // Allow `triggers` to be configured as a function
    if (_.isFunction(triggers)){ triggers = triggers.call(this); }

    // Configure the triggers, prevent default
    // action and stop propagation of DOM events
    _.each(triggers, function(value, key){

      triggerEvents[key] = function(e){
        if (e && e.preventDefault){ e.preventDefault(); }
        if (e && e.stopPropagation){ e.stopPropagation(); }
        that.trigger(value);
      };

    });

    return triggerEvents;
  },

  // Overriding Backbone.View's delegateEvents specifically
  // to handle the `triggers` configuration
  delegateEvents: function(events){
    events = events || this.events;
    if (_.isFunction(events)){ events = events.call(this); }

    var combinedEvents = {};
    var triggers = this.configureTriggers();
    _.extend(combinedEvents, events, triggers);

    Backbone.View.protosourceType.delegateEvents.call(this, combinedEvents);
  },

  // Internal method, handles the `show` event.
  onShowCalled: function(){},

  // Default `close` implementation, for removing a view from the
  // DOM and unbinding it. Regions will call this method
  // for you. You can specify an `onClose` method in your view to
  // add custom code that is called after the view is closed.
  close: function(){
    if (this.isClosed) { return; }

    this.triggerMethod("before:close");

    this.remove();
    this.unbindAll();

    this.triggerMethod("close");
    this.isClosed = true;
  },

  // This method binds the elements specified in the "ui" hash inside the view's code with
  // the associated jQuery selectors.
  bindUIElements: function(){
    if (!this.ui) { return; }

    var that = this;

    if (!this.uiBindings) {
      // We want to store the ui hash in uiBindings, since afterwards the values in the ui hash
      // will be overridden with jQuery selectors.
      this.uiBindings = this.ui;
    }

    // refreshing the associated selectors since they should point to the newly rendered elements.
    this.ui = {};
    _.each(_.keys(this.uiBindings), function(key) {
      var selector = that.uiBindings[key];
      that.ui[key] = that.$(selector);
    });
  },

  // A "data source" is what drives view rendering (for example, "model"
  // or "controller"). This can be set if you wish to create your own base
  // view sourceTypes that extend from Marionette.View
  //
  // defining a data source will:
  //  - pull options.sourceName from initialize options, and set it on the view
  //  - bind initial events you set in this._dataSources
  //  - allow extensions to your base sourceType to define events hashes, which will
  //    also get bound. (e.g. modelEvents, collectionEvents)
  //  - create attach and detach methods (e.g. attachModel, detachModel), which
  //    allows users to set or unset a model as the "data source" for the view
  //
  // Expecting source to look like
  //
  // { name: "name", initialEvents: {}, renderMethod: "methodName" }
  //
  // NOTE: name is the only required attribute.
  // renderMethod is optional, by default it will be render<Name>
  // initialEvents is optional, by default it will be empty {}
  _dataSources: [],
  defineDataSource: function(params){
    this._dataSources.push( new Marionette.DataSource(params) );
  },

  // actually create the data sources. This should only be called once in the life
  // cycle of the view
  initializeDataSources: function(options){
    var view = this;

    _.each(this._dataSources, function(initialEvents, entityType){
      // pull the entity we are binding to either from the options or the view
      var entity = options[entityType] || view[entityType];

      view.attachDataSource(entityType, entity);

      var capitalized = entityType.charAt(0).toUpperCase() + entityType.slice(1);
      view['attach'+ capitalized] = function(source){
        view.attachDataSource(entityType, source);
      }

      view['detach'+ capitalized] = function(){
        view.detachDataSource(entityType);
      }
    });
  },

  // attach a model instance to be this views "data source" for a type of event
  attachDataSource: function(sourceType, entity){
    // we want a combination of the events defined on the base type (dataSources[sourceType]),
    // and events defined on the inherited sourceType (e.g. modelEvents)
    var events = _.extend({}, this.dataSources[sourceType], this[sourceType +"Events"]);

    var view = this;
    // set the entity on the model, (e.g. this.model)
    this[sourceType] = entity;

    // if there is an existing data source attached, it will be detached
    view.detachDataSource(sourceType);

    // bind each event
    _.each(events, function(methodName, evt){

      var method = view[methodName];
      if(!method) {
        throw new Error("View method '"+ methodName +"' was configured as an event handler, but does not exist.");
      }

      view.bindTo(entity, evt, method, view);
    });
  },

  // detach all events bound for a given source type (like 'model' or 'collection')
  detachDataSource: function(type){
    var entity = this[type];

    this.unbindFor(entity);
    if(this[type]) delete this[type];
  }
});
