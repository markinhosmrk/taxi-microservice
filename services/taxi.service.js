"use strict";

const DbMixin = require("../mixins/db.mixin");

/**
 * @typedef {import('moleculer').Context} Context Moleculer's Context
 */

module.exports = {
	name: "taxi",
	// version: 1

	/**
	 * Mixins
	 */
	mixins: [DbMixin("taxi")],

	/**
	 * Settings
	 */
	settings: {
		// Available fields in the responses
		fields: [
			"_id",
			"idDriver",
			"maker",
			"model",
			"year",
			"color",
			"registerDate",
			"firstTripDate",
			"lastTripDate",			
			"lastPosUpdateDate",
			"lastLat",
			"lastLon",
			"numOfTrips",
			"distanceTraveled",
			"avgDistPerTrip"
		],

		// Validator for the `create` & `insert` actions.
		entityValidator: {
			idDriver: "string",
			maker: "string|min:2|max:30",
			model: "string|min:2|max:30",
			registerDate: "date",
			firstTripDate: "date|optional",
			lastTripDate: "date|optional",
			lastPosUpdateDate: "date|optional",
			lastLat: "number", 
			lastLon: "number", 
			year: "number|integer|positive|min:1900|max:2999",
			color: "string|min:2|max:30",
			numOfTrips: "number|positive",
			distanceTraveled: "number|positive",
			avgDistPerTrip: "number|positive"
		}
	},

	/**
	 * Action Hooks
	 */
	hooks: {
		before: {
			/**
			 * Register a before hook for the `create` action.
			 * It sets a default value for the quantity field.
			 *
			 * @param {Context} ctx
			 */
			create(ctx) {
				ctx.params.registerDate = new Date();
				ctx.params.idDriver = 0;
				ctx.params.numOfTrips = 0;
				ctx.params.distanceTraveled = 0;
				ctx.params.avgDistPerTrip = 0;
			}
		}
	},

	/**
	 * Actions
	 */
	actions: {
		/**
		 * The "moleculer-db" mixin registers the following actions:
		 *  - list
		 *  - find
		 *  - count
		 *  - create
		 *  - insert
		 *  - update
		 *  - remove
		 */

		// --- ADDITIONAL ACTIONS ---

		/**
		 * Assign a driver to a taxi.
		 */
		assignDriver: {
			rest: "PUT /:id/idDriver/assign",
			params: {
				id: "string",
				idDriver: "string"
			},
			async handler(ctx) {
				const doc = await this.adapter.updateById(ctx.params.id, { $set: { idDriver: ctx.params.idDriver } });
				const json = await this.transformDocuments(ctx, ctx.params, doc);
				await this.entityChanged("updated", json, ctx);

				return json;				
			}
		},

		/**
		 * Register new trip
		 */
		registerTrip: {
			rest: "PUT /:id/trip/register",
			params: {
				id: "string",
				distance: "number|positive"
			},
			async handler(ctx) {
				var item = await this.actions.get({id : ctx.params.id});
						
				if(isNaN(item.numOfTrips)) {
					item.numOfTrips = 1;
				} else {
					item.numOfTrips += 1;
				}
				
				if(item.firstTripDate == null) {
					item.firstTripDate = new Date();
					item.lastTripDate = item.firstTripDate;
				} else {
					item.lastTripDate = new Date();
				}
				
				if(isNaN(item.distanceTraveled)) {
					item.distanceTraveled = ctx.params.distance;
				} else {
					item.distanceTraveled += ctx.params.distance;
				}				
				
				if(isNaN(item.avgDistPerTrip)) {
					item.avgDistPerTrip = item.distanceTraveled;
				} else {
					item.avgDistPerTrip += (item.distanceTraveled / item.numOfTrips);
				}								
								
				const doc = await this.adapter.updateById(ctx.params.id, { $set: { numOfTrips: item.numOfTrips, firstTripDate: item.firstTripDate, lastTripDate: item.lastTripDate, distanceTraveled: item.distanceTraveled, avgDistPerTrip: item.avgDistPerTrip}} );
				const json = await this.transformDocuments(ctx, ctx.params, doc);
				await this.entityChanged("updated", json, ctx);		

				return json;
			}
		},		
		
		/**
		 * Update position
		 */
		updatePosition: {
			rest: "PUT /:id/position/update",
			params: {
				id: "string",
				lat: "number",
				lon: "number"
			},
			async handler(ctx) {
				const doc = await this.adapter.updateById(ctx.params.id, { $set: { lastLat: ctx.params.lat, lastLon: ctx.params.lon, lastPosUpdateDate: new Date() } });
				const json = await this.transformDocuments(ctx, ctx.params, doc);
				await this.entityChanged("updated", json, ctx);

				return json;				
			}
		},		

		/**
		 * Find taxis nearby a position
		 */
		findTaxisNearby: {
			rest: "POST /position/findNearby",
			params: {
				lat: "number",
				lon: "number",
				distance: "number|integer|positive"
			},
			async handler(ctx) {
				const items = await this.actions.find({ query: { lastPosUpdateDate: { $exists: true } }});
				var doc = [];
				
				items.forEach(item => {
					if(!isNaN(item.lastLat) && !isNaN(item.lastLon) && item.lastPosUpdateDate != null) {
						var result = this.getDistanceByLatLon(item.lastLat, item.lastLon, ctx.params.lat, ctx.params.lon);
						
						this.logger.info("findTaxisNearby: taxi  " + item._id + " distance from point: " + result + ", requested: " + ctx.params.distance);
						if(result <= ctx.params.distance) doc.push(item);
					}
				});

				const json = await this.transformDocuments(ctx, ctx.params, doc);
				await this.entityChanged("updated", json, ctx);

				return json;				
			}
		},		
		
	},

	/**
	 * Methods
	 */
	methods: {
		/**
		 * Loading sample data to the collection.
		 * It is called in the DB.mixin after the database
		 * connection establishing & the collection is empty.
		 */
		async seedDB() {
			await this.adapter.insertMany([
				{ maker: "Fiat", model: "Palio", year: "2014", color: "Preto" },
				{ maker: "Fiat", model: "Uno", year: "2012", color: "Verde" },
				{ maker: "Ford", model: "Ka", year: "2017", color: "Branco" },
				{ maker: "Ford", model: "Fiesta", year: "2015", color: "Azul" },
				{ maker: "Chevrolet", model: "Onix", year: "2016", color: "Preto" },
				{ maker: "Chrevolet", model: "Cobalt", year: "2015", color: "Prata" },
				{ maker: "Hyundai", model: "HB20", year: "2017", color: "Branco" },
				{ maker: "Renault", model: "Sandero", year: "2013", color: "Vermelho" },
				{ maker: "Volkswagen", model: "Gol", year: "2018", color: "Prata" },				
				{ maker: "Volkswagen", model: "Voyage", year: "2017", color: "Branco" }				
			]);
		},
		
		/**
		 * Helper function to find nearby taxis by given lat/lon
		 */
		getDistanceByLatLon(taxi_lat, taxi_lon, point_lat, point_lon) {
			return (6371 * Math.acos(
						Math.cos(point_lat * Math.PI /180) *
						Math.cos(taxi_lat * Math.PI /180) *
						Math.cos((taxi_lon * Math.PI /180) - (point_lon * Math.PI /180)) +
						Math.sin(point_lat * Math.PI / 180) *
						Math.sin(taxi_lat * Math.PI / 180)) 
					) ;
		},
	
		/**
		 * Fired after database connection establishing.
		 */
		async afterConnected() {
			// await this.adapter.collection.createIndex({ name: 1 });
		}
	}
};
