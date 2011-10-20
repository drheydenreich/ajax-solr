// $Id$

/**
 * Baseclass for all facet widgets.
 *
 * @class AbstractFacetWidget
 * @augments AjaxSolr.AbstractWidget
 */
AjaxSolr.AbstractFacetWidget = AjaxSolr.AbstractWidget.extend(
  /** @lends AjaxSolr.AbstractFacetWidget.prototype */
  {
  /**
   * The field to facet on.
   *
   * @field
   * @public
   * @type String
   */
  field: null,

  /**
   * Set to <tt>false</tt> to force a single "fq" parameter for this widget.
   *
   * @field
   * @public
   * @type Boolean
   * @default true
   */
  multivalue: true,
  
  /**
   * Set to <tt>true</tt> to have a facet query that returns a union (or).
   */
  union : false,
  
  /**
   * Set a tag for the fq parameter like fq={!tag=mytag}field.
   */
  tag : null,

  /**
   * Set to change the key i.e. facet.query={!key=today
   * ex=dateFacet}dates:[NOW/DAY TO *]
   */
  key : null,

  /**
   * Set a local exclude for the facet.field i.e.
   * facet.field={!ex=mytag}field
   */
  ex : null,

  init: function () {
    this.initStore();
  },

  /**
   * Add facet parameters to the parameter store.
   */
  initStore: function () {
    var param;
    
    /* http://wiki.apache.org/solr/SimpleFacetParameters */
    var parameters = [
      'facet.prefix',
      'facet.sort',
      'facet.limit',
      'facet.offset',
      'facet.mincount',
      'facet.missing',
      'facet.method',
      'facet.enum.cache.minDf'
    ];

    this.manager.store.addByValue('facet', true);

    // Set facet.field, facet.date or facet.range to truthy values to add
    // related per-field parameters to the parameter store.
    if (this['facet.field'] !== undefined) {
      param = this.manager.store.addByValue('facet.field', this.field);
    }
    else if (this['facet.date'] !== undefined) {
      param = this.manager.store.addByValue('facet.date', this.field);
      parameters = parameters.concat([
        'facet.date.start',
        'facet.date.end',
        'facet.date.gap',
        'facet.date.hardend',
        'facet.date.other',
        'facet.date.include'
      ]);
    }
    else if (this['facet.range'] !== undefined) {
      param = this.manager.store.addByValue('facet.range', this.field);
      parameters = parameters.concat([
        'facet.range.start',
        'facet.range.end',
        'facet.range.gap',
        'facet.range.hardend',
        'facet.range.other',
        'facet.range.include'
      ]);
    }
    
    if (param) {
      if (this.key) {
        param.local("key", this.key);
      }
      if (this.ex) {
        param.local("ex", this.ex);
      }
    }

    for (var i = 0, l = parameters.length; i < l; i++) {
      if (this[parameters[i]] !== undefined) {
        this.manager.store.addByValue('f.' + this.field + '.' + parameters[i], this[parameters[i]]);
      }
    }
  },

  /**
   * @returns {Boolean} Whether any filter queries have been set using this
   *   widget's facet field.
   */
  isEmpty: function () {
    return !this.manager.store.find('fq', new RegExp('^-?' + this.field + ':'));
  },

  /**
   * Sets the filter query.
   *
   * @returns {Boolean} Whether the selection changed.
   */
  set: function (value) {
    return this.changeSelection(function () {
      var a = this.manager.store.removeByValue('fq', new RegExp('^-?' + this.field + ':')),
          b = this.manager.store.addByValue('fq', this.fq(value));
      if (b && this.tag) {
        b.local("tag", this.tag);
      }
      return a || b;
    });
  },

  /**
   * Adds a filter query.
   *
   * @returns {Boolean} Whether a filter query was added.
   */
  add: function (value) {
    return this.changeSelection(function () {
      var param = this.manager.store.addByValue('fq', this.fq(value));
      if (param && this.tag) {
        param.local("tag", this.tag);
      }
      return param;
    });
  },
  
  /**
   * Append to the filter query.
   * 
   * @returns {Boolean} Whether the selection changed.
   */
  append : function(value) {
    return this.changeSelection(function() {
      var params, param, vals;
      value = AjaxSolr.Parameter.escapeValue(value);
      params = this.getParams();
      if (params) {
        vals = this.getQueryValues(params);
        param = params[0];
        if (AjaxSolr.inArray(value, vals) < 0) {
          vals.push(value);
          param.val(this.fq('(' + vals.join(" ") + ')'));
          return true;
        }
      } else {
        param = this.manager.store.addByValue('fq', this.fq('(' + value
            + ')'));
        if (param && this.tag) {
          param.local("tag", this.tag);
        }
        return true;
      }

      return false;
    });
  },

  /**
   * Removes a filter query.
   *
   * @returns {Boolean} Whether a filter query was removed.
   */
  remove: function (value) {
    return this.changeSelection(function () {
      if (this.multivalue && this.union) {
        var params, param, vals;
        value = AjaxSolr.Parameter.escapeValue(value);
        params = this.getParams();
        if (params) {
          vals = this.getQueryValues(params).filter(function(elmt, idx) {
            return elmt != value;
          });
          if (vals.length > 0) {
            params[0].val(this.fq('(' + vals.join(" ") + ')'));
            return true;
          } else {
            return this.manager.store.removeByValue('fq', this.fq('('
                + value + ')'));
          }
        }
      }
      return this.manager.store.removeByValue('fq', this.fq(value));
    });
  },

  /**
   * Removes all filter queries using the widget's facet field.
   *
   * @returns {Boolean} Whether a filter query was removed.
   */
  clear: function () {
    return this.changeSelection(function () {
      return this.manager.store.removeByValue('fq', new RegExp('^-?' + this.field + ':'));
    });
  },

  /**
   * Helper for selection functions.
   *
   * @param {Function} Selection function to call.
   * @returns {Boolean} Whether the selection changed.
   */
  changeSelection: function (func) {
    changed = func.apply(this);
    if (changed) {
      this.afterChangeSelection();
    }
    return changed;
  },

  /**
   * An abstract hook for child implementations.
   *
   * <p>This method is executed after the filter queries change.</p>
   */
  afterChangeSelection: function () {},

  /**
   * One of "facet.field", "facet.date" or "facet.range" must be set on the
   * widget in order to determine where the facet counts are stored.
   *
   * @returns {Array} An array of objects with the properties <tt>facet</tt> and
   * <tt>count</tt>, e.g <tt>{ facet: 'facet', count: 1 }</tt>.
   */
  getFacetCounts: function () {
    var property;
    if (this['facet.field'] !== undefined) {
      property = 'facet_fields';
    }
    else if (this['facet.date'] !== undefined) {
      property = 'facet_dates';
    }
    else if (this['facet.range'] !== undefined) {
      property = 'facet_ranges';
    }
    if (property !== undefined) {
      switch (this.manager.store.get('json.nl').val()) {
        case 'map':
          return this.getFacetCountsMap(property);
        case 'arrarr':
          return this.getFacetCountsArrarr(property);
        default:
          return this.getFacetCountsFlat(property);
      }
    }
    throw 'Cannot get facet counts unless one of the following properties is set to "true" on widget "' + this.id + '": "facet.field", "facet.date", or "facet.range".';
  },

  /**
   * Used if the facet counts are represented as a JSON object.
   *
   * @param {String} property "facet_fields", "facet_dates", or "facet_ranges".
   * @returns {Array} An array of objects with the properties <tt>facet</tt> and
   * <tt>count</tt>, e.g <tt>{ facet: 'facet', count: 1 }</tt>.
   */
  getFacetCountsMap: function (property) {
    var counts = [];
    for (var facet in this.manager.response.facet_counts[property][this.field]) {
      counts.push({
        facet: facet,
        count: parseInt(this.manager.response.facet_counts[property][this.field][facet])
      });
    }
    return counts;
  },

  /**
   * Used if the facet counts are represented as an array of two-element arrays.
   *
   * @param {String} property "facet_fields", "facet_dates", or "facet_ranges".
   * @returns {Array} An array of objects with the properties <tt>facet</tt> and
   * <tt>count</tt>, e.g <tt>{ facet: 'facet', count: 1 }</tt>.
   */
  getFacetCountsArrarr: function (property) {
    var counts = [];
    for (var i = 0, l = this.manager.response.facet_counts[property][this.field].length; i < l; i++) {
      counts.push({
        facet: this.manager.response.facet_counts[property][this.field][i][0],
        count: parseInt(this.manager.response.facet_counts[property][this.field][i][1])
      });
    }
    return counts;
  },

  /**
   * Used if the facet counts are represented as a flat array.
   *
   * @param {String} property "facet_fields", "facet_dates", or "facet_ranges".
   * @returns {Array} An array of objects with the properties <tt>facet</tt> and
   * <tt>count</tt>, e.g <tt>{ facet: 'facet', count: 1 }</tt>.
   */
  getFacetCountsFlat: function (property) {
    var counts = [];
    for (var i = 0, l = this.manager.response.facet_counts[property][this.field].length; i < l; i += 2) {
      counts.push({
        facet: this.manager.response.facet_counts[property][this.field][i],
        count: parseInt(this.manager.response.facet_counts[property][this.field][i+1])
      });
    }
    return counts;
  },

  /**
   * @param {String} value The value.
   * @returns {Function} Sends a request to Solr if it successfully adds a
   *   filter query with the given value.
   */
  clickHandler: function (value) {
    var self = this, meth = this.multivalue ? (this.union ? 'append' : 'add') : 'set';
    return function () {
      if (self[meth].call(self, value)) {
        self.manager.doRequest(0);
      }
      return false;
    }
  },

  /**
   * @param {String} value The value.
   * @returns {Function} Sends a request to Solr if it successfully removes a
   *   filter query with the given value.
   */
  unclickHandler: function (value) {
    var self = this;
    return function () {
      if (self.remove(value)) {
        self.manager.doRequest(0);
      }
      return false;
    }
  },

  /**
   * @param {String} value The facet value.
   * @param {Boolean} exclude Whether to exclude this fq parameter value.
   * @returns {String} An fq parameter value.
   */
  fq: function (value, exclude) {
    return (exclude ? '-' : '') + this.field + ':' + AjaxSolr.Parameter.escapeValue(value);
  },
  
  /**
   * Retrieve all fq parameters of this widget
   * 
   * @returns
   */
  getParams : function() {
    var a = this.manager.store.find('fq', new RegExp('^-?' + this.field
        + ':'));
    var params = [];
    for ( var i in a) {
      params.push(this.manager.store.params.fq[a[i]]);
    }
    return params.length == 0 ? false : params;
  },

  /**
   * Return an array of the selected facet values.
   * 
   * @param params
   * @returns {Array}
   */
  getQueryValues : function(params) {
    var param, q, i;
    var values = [];
    if (params) {
      for (i in params) {
        param = params[i];
        q = (this.union ? new RegExp('^-?' + this.field + ':\\((.*)\\)')
            : new RegExp('^-?' + this.field + ':(.*)')).exec(param.val())[1];
        if (this.union) {
          values = AjaxSolr.parseStringList(q).slice();
        } else {
          values.push(q);
        }
      }
    }
    return values;
  },

  /**
   * Return the position of the given value in the array of selected facet
   * values. -1 if not selected.
   * 
   * @param value
   * @returns
   */
  inQuery : function(value) {
    return AjaxSolr.inArray(AjaxSolr.Parameter.escapeValue(value), this
        .getQueryValues(this.getParams()));
  }
});
