var rulesets = {
	'input[type="text"]': {
		blur: function(e) { if (this.value == '') this.value = this.defaultValue; },
		focus: function(e) { if (this.value == this.defaultValue) this.value = ''; },
		change: function(e) { if (this.value == '') this.style.border = '2px solid #f00'; else this.style.cssText = ''; },
		mouseout: function(e) { this.style.backgroundColor = ''; },
		mouseover: function(e) { this.style.backgroundColor = '#ecf'; }
	},
	'ul li:nth-of-type(even), table tr:nth-of-type(odd) td:nth-of-type(even), table tr:nth-of-type(even) td:nth-of-type(odd)': {
		mouseout: function(e) { this.style.backgroundColor = ''; },
		mouseover: function(e) { this.style.backgroundColor = '#fc6'; }
	},
	'ul li:nth-of-type(odd), table tr:nth-of-type(odd) td:nth-of-type(odd), table tr:nth-of-type(even) td:nth-of-type(even)': {
		mouseout: function(e) { this.style.backgroundColor = ''; },
		mouseover: function(e) { this.style.backgroundColor = '#396'; }
	}
};

