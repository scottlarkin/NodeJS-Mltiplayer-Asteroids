function vector2(xp, yp) {
	return {
		x: xp || 0,
		y: yp || 0,
		add: function (vec2) {
			return new vector2(this.x + vec2.x, this.y + vec2.y);
		},
		subtract: function (vec2) {
			return new vector2(this.x - vec2.x, this.y - vec2.y);
		},
		rotate: function (v, degrees) {
			var rads = degrees * 0.0174532925;
			var s = Math.sin(rads);
			var c = Math.cos(rads);

			var temp = new vector2(this.x, this.y);
			temp = temp.subtract(v);

			var tx = temp.x;
			var ty = temp.y;

			temp.x = (c * tx) - (s * ty);
			temp.y = (s * tx) + (c * ty);

			temp = temp.add(v);

			return temp;
		},
		inverse: function () {
			return new vector2(-this.x, -this.y);
		},
		multiply: function (vec2) {
			return new vector2(this.x * vec2.x, this.y * vec2.y);
		},
		magnitude: function () {
			return Math.sqrt((this.x * this.x) + (this.y * this.y));
		},
		normalise: function () {
			var tx = this.x;
			var ty = this.y;
			var l = this.magnitude();
			tx /= l;
			ty /= l;
			return new vector2(tx, ty);
		}
	};
}
