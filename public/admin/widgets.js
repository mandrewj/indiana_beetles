/* eslint-disable */
/**
 * Custom Decap CMS widgets for Beetles of Indiana.
 *
 * Loaded after decap-cms.js by public/admin/index.html. Uses Decap's
 * globally-exposed `createClass` (React class factory) and `h`
 * (React.createElement-like) — no JSX, no build step.
 *
 * Widgets registered:
 *   - taxon-lookup       — number input + "Look up" button (GBIF or iNat).
 *   - status-picker      — 4 semantic tiles for indiana_status.
 *   - phenology-picker   — 12-month clickable grid.
 *   - county-map         — Indiana choropleth selector.
 */
(function () {
  if (typeof window.CMS === "undefined") {
    console.error("Decap CMS not loaded; widgets cannot register.");
    return;
  }
  var h = window.h;
  var createClass = window.createClass;
  if (!h || !createClass) {
    console.error("Decap did not expose h/createClass on window.");
    return;
  }

  // ─────────────────────────────────────────────
  // Indiana county list — same as data/county-lookup.json
  // ─────────────────────────────────────────────
  var ALL_COUNTIES = [
    "Adams","Allen","Bartholomew","Benton","Blackford","Boone","Brown","Carroll",
    "Cass","Clark","Clay","Clinton","Crawford","Daviess","Dearborn","Decatur",
    "DeKalb","Delaware","Dubois","Elkhart","Fayette","Floyd","Fountain","Franklin",
    "Fulton","Gibson","Grant","Greene","Hamilton","Hancock","Harrison","Hendricks",
    "Henry","Howard","Huntington","Jackson","Jasper","Jay","Jefferson","Jennings",
    "Johnson","Knox","Kosciusko","LaGrange","Lake","LaPorte","Lawrence","Madison",
    "Marion","Marshall","Martin","Miami","Monroe","Montgomery","Morgan","Newton",
    "Noble","Ohio","Orange","Owen","Parke","Perry","Pike","Porter","Posey",
    "Pulaski","Putnam","Randolph","Ripley","Rush","St. Joseph","Scott","Shelby",
    "Spencer","Starke","Steuben","Sullivan","Switzerland","Tippecanoe","Tipton",
    "Union","Vanderburgh","Vermillion","Vigo","Wabash","Warren","Warrick",
    "Washington","Wayne","Wells","White","Whitley"
  ];

  // ─────────────────────────────────────────────
  // Helper: read scientific name from the current entry
  // ─────────────────────────────────────────────
  function readScientificName(props) {
    try {
      var entry = props.entry;
      if (!entry || typeof entry.getIn !== "function") return "";
      var name = entry.getIn(["data", "scientific_name"]);
      return name ? String(name).trim() : "";
    } catch (e) {
      return "";
    }
  }

  // ─────────────────────────────────────────────
  // 1. taxon-lookup — number input + "Look up" button
  //
  // Field config:
  //   - { widget: taxon-lookup, source: gbif | inat }
  // ─────────────────────────────────────────────
  var TaxonLookupControl = createClass({
    getInitialState: function () {
      return { loading: false, error: null, lastQueryName: null };
    },
    handleChange: function (e) {
      var raw = e.target.value;
      if (raw === "" || raw === null || raw === undefined) {
        this.props.onChange(null);
        return;
      }
      var n = Number(raw);
      this.props.onChange(Number.isFinite(n) ? n : raw);
    },
    handleLookup: function () {
      var self = this;
      var name = readScientificName(this.props);
      if (!name) {
        self.setState({ error: "Set the scientific name first.", loading: false });
        return;
      }
      var source = (this.props.field && this.props.field.get("source")) || "gbif";
      self.setState({ loading: true, error: null, lastQueryName: name });

      var promise;
      if (source === "inat") {
        promise = fetch(
          "https://api.inaturalist.org/v1/taxa?q=" + encodeURIComponent(name) + "&rank=species&per_page=1"
        )
          .then(function (r) { return r.json(); })
          .then(function (data) {
            var t = data && data.results && data.results[0];
            if (!t) throw new Error("No iNaturalist match for " + name);
            return t.id;
          });
      } else {
        promise = fetch(
          "https://api.gbif.org/v1/species/match?name=" + encodeURIComponent(name) + "&strict=false"
        )
          .then(function (r) { return r.json(); })
          .then(function (data) {
            var key = data && (data.usageKey || data.speciesKey);
            if (!key) throw new Error("No GBIF match for " + name);
            return key;
          });
      }

      promise
        .then(function (id) {
          self.props.onChange(Number(id));
          self.setState({ loading: false, error: null });
        })
        .catch(function (err) {
          self.setState({
            loading: false,
            error: (err && err.message) ? err.message : "Lookup failed",
          });
        });
    },
    render: function () {
      var value = this.props.value;
      var stringValue = value === null || value === undefined ? "" : String(value);
      var source = (this.props.field && this.props.field.get("source")) || "gbif";
      var label = source === "inat" ? "Look up on iNaturalist" : "Look up on GBIF";

      return h(
        "div",
        { className: "bin-taxon-lookup" },
        h("input", {
          type: "number",
          value: stringValue,
          onChange: this.handleChange,
          className: (this.props.classNameWrapper || "") + " bin-number",
          placeholder: source === "inat" ? "iNat taxon id" : "GBIF taxon key",
          id: this.props.forID,
        }),
        h(
          "button",
          {
            type: "button",
            className: "bin-btn",
            onClick: this.handleLookup,
            disabled: this.state.loading,
          },
          this.state.loading ? "Looking up…" : label
        ),
        this.state.error
          ? h("div", { className: "bin-lookup-error" }, this.state.error)
          : null,
        this.state.lastQueryName && !this.state.loading && !this.state.error && value
          ? h(
              "div",
              { className: "bin-lookup-ok" },
              "Matched " + this.state.lastQueryName + " → " + value
            )
          : null
      );
    },
  });

  CMS.registerWidget("taxon-lookup", TaxonLookupControl);

  // ─────────────────────────────────────────────
  // 2. status-picker — 4 semantic tiles
  // ─────────────────────────────────────────────
  var STATUS_OPTIONS = [
    { value: "confirmed",  label: "Confirmed",  hint: "Documented in Indiana", className: "bin-status-confirmed" },
    { value: "historical", label: "Historical", hint: "Older records only",    className: "bin-status-historical" },
    { value: "adventive",  label: "Adventive",  hint: "Established non-native", className: "bin-status-adventive" },
    { value: "excluded",   label: "Excluded",   hint: "Erroneously reported",   className: "bin-status-excluded" },
  ];

  var StatusPickerControl = createClass({
    render: function () {
      var self = this;
      var current = self.props.value || "confirmed";
      return h(
        "div",
        { className: "bin-status-grid" },
        STATUS_OPTIONS.map(function (opt) {
          return h(
            "button",
            {
              type: "button",
              key: opt.value,
              className:
                "bin-status-tile " + opt.className +
                (current === opt.value ? " is-active" : ""),
              onClick: function () { self.props.onChange(opt.value); },
            },
            h("span", { className: "bin-status-dot" }),
            h("span", { className: "bin-status-label" }, opt.label),
            h("span", { className: "bin-status-hint" }, opt.hint)
          );
        })
      );
    },
  });

  CMS.registerWidget("status-picker", StatusPickerControl, undefined, {
    type: "string",
  });

  // ─────────────────────────────────────────────
  // 3. phenology-picker — 12-month clickable grid
  //
  // Value is an array of integers 1–12.
  // ─────────────────────────────────────────────
  var MONTH_LETTERS = ["J","F","M","A","M","J","J","A","S","O","N","D"];

  var PhenologyPickerControl = createClass({
    toJS: function () {
      var v = this.props.value;
      if (!v) return [];
      if (Array.isArray(v)) return v.map(function (x) { return Number(x); });
      if (typeof v.toJS === "function") return v.toJS().map(function (x) { return Number(x); });
      return [];
    },
    toggle: function (month) {
      var current = this.toJS();
      var idx = current.indexOf(month);
      var next = idx >= 0
        ? current.filter(function (x) { return x !== month; })
        : current.concat([month]).sort(function (a, b) { return a - b; });
      // Decap select widgets often expect string values. Send strings to stay
      // schema-compatible with the existing select options.
      this.props.onChange(next.map(function (x) { return String(x); }));
    },
    render: function () {
      var self = this;
      var current = self.toJS();
      var hint = (self.props.field && self.props.field.get("hint")) || null;
      return h(
        "div",
        { className: "bin-phenology" },
        h(
          "div",
          { className: "bin-phenology-grid" },
          MONTH_LETTERS.map(function (letter, i) {
            var month = i + 1;
            var on = current.indexOf(month) >= 0;
            return h(
              "button",
              {
                type: "button",
                key: month,
                className: "bin-month" + (on ? " is-on" : ""),
                onClick: function () { self.toggle(month); },
                title: "Month " + month,
              },
              letter
            );
          })
        ),
        hint ? h("div", { className: "bin-phenology-hint" }, hint) : null
      );
    },
  });

  CMS.registerWidget("phenology-picker", PhenologyPickerControl);

  // ─────────────────────────────────────────────
  // 4. county-map — Indiana county selector (override only)
  //
  // Value: array of county names (strings, exactly matching the FIPS lookup).
  // ─────────────────────────────────────────────
  var CountyMapControl = createClass({
    toJS: function () {
      var v = this.props.value;
      if (!v) return [];
      if (Array.isArray(v)) return v.slice();
      if (typeof v.toJS === "function") return v.toJS();
      return [];
    },
    toggle: function (name) {
      var current = this.toJS();
      var idx = current.indexOf(name);
      var next = idx >= 0
        ? current.filter(function (x) { return x !== name; })
        : current.concat([name]).sort(function (a, b) { return a.localeCompare(b); });
      this.props.onChange(next);
    },
    clearAll: function () { this.props.onChange([]); },
    selectAll: function () { this.props.onChange(ALL_COUNTIES.slice()); },
    render: function () {
      var self = this;
      var current = self.toJS();
      return h(
        "div",
        { className: "bin-county-map" },
        h(
          "div",
          { className: "bin-county-toolbar" },
          h("span", { className: "bin-county-count" },
            current.length + " of " + ALL_COUNTIES.length + " selected"),
          h("button", {
            type: "button",
            className: "bin-btn bin-btn-ghost",
            onClick: self.selectAll,
          }, "Select all"),
          h("button", {
            type: "button",
            className: "bin-btn bin-btn-ghost",
            onClick: self.clearAll,
          }, "Clear")
        ),
        h(
          "div",
          { className: "bin-county-grid" },
          ALL_COUNTIES.map(function (name) {
            var on = current.indexOf(name) >= 0;
            return h(
              "button",
              {
                type: "button",
                key: name,
                className: "bin-county-cell" + (on ? " is-on" : ""),
                onClick: function () { self.toggle(name); },
              },
              name
            );
          })
        )
      );
    },
  });

  CMS.registerWidget("county-map", CountyMapControl);
})();
