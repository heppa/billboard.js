/**
 * Copyright (c) 2017 ~ present NAVER Corp.
 * billboard.js project is licensed under the MIT license
 */
import {selectAll as d3SelectAll} from "d3-selection";
import {easeLinear as d3EaseLinear} from "d3-ease";
import {transition as d3Transition} from "d3-transition";
import {diffDomain} from "../../module/util";
import CLASS from "../../config/classes";

export default {
	/**
	 * Generate flow
	 * @memberof ChartInternal
	 * @private
	 * @param {Object} args
	 * @return {Function}
	 */
	generateFlow(args) {
		const $$ = this;
		const {config, data, scale: {x}, state, $el} = $$;

		return function() {
			const {duration, flow, shape, targets, xv} = args;
			const {bar: drawBar, line: drawLine, area: drawArea} = shape.type;
			const {cx, cy, xForText, yForText} = shape.pos;
			const {
				done = () => {},
				duration: durationForFlow = duration,
				index: flowIndex,
				length: flowLength
			} = flow;
			const wait = $$.generateWait();
			const dataValues = data.targets[0].values;

			let flowStart = $$.getValueOnIndex(dataValues, flowIndex);
			let flowEnd = $$.getValueOnIndex(dataValues, flowIndex + flowLength);
			let translateX;
			let scaleX = 1;

			// elements
			const xAxis = $el.axis.x;
			const xgrid = $el.grid.x || d3SelectAll([]);
			const xgridLines = $el.gridLines.x || d3SelectAll([]);
			const mainRegion = $el.region.list || d3SelectAll([]);
			const mainText = $el.text || d3SelectAll([]);
			const mainBar = $el.bar || d3SelectAll([]);
			const mainLine = $el.line || d3SelectAll([]);
			const mainArea = $el.area || d3SelectAll([]);
			const mainCircle = $el.circle || d3SelectAll([]);

			// set flag
			state.flowing = true;

			// remove head data after rendered
			data.targets.forEach(d => {
				d.values.splice(0, flowLength);
			});

			// update x domain to generate axis elements for flow
			const orgDomain = x.domain();
			const domain = $$.updateXDomain(targets, true, true);

			// update elements related to x scale
			if ($$.updateXGrid) { $$.updateXGrid(true); }

			// generate transform to flow
			if (!flow.orgDataCount) { // if empty
				if (dataValues.length !== 1) {
					translateX = x(orgDomain[0]) - x(domain[0]);
				} else {
					if ($$.isTimeSeries()) {
						flowStart = $$.getValueOnIndex(dataValues, 0);
						flowEnd = $$.getValueOnIndex(dataValues, dataValues.length - 1);
						translateX = x(flowStart.x) - x(flowEnd.x);
					} else {
						translateX = diffDomain(domain) / 2;
					}
				}
			} else if (flow.orgDataCount === 1 || (flowStart && flowStart.x) === (flowEnd && flowEnd.x)) {
				translateX = x(orgDomain[0]) - x(domain[0]);
			} else {
				translateX = $$.isTimeSeries() ?
					(x(orgDomain[0]) - x(domain[0])) :
					(x(flowStart.x) - x(flowEnd.x));
			}

			scaleX = (diffDomain(orgDomain) / diffDomain(domain));

			$$.hideGridFocus();

			const transform = `translate(${translateX},0) scale(${scaleX},1)`;
			const gt = d3Transition().ease(d3EaseLinear)
				.duration(durationForFlow);

			wait.add([
				xAxis
					.transition(gt)
					.call(g => $$.axis.x.setTransition(gt).create(g)),

				mainBar
					.transition(gt)
					.attr("transform", transform),

				mainLine
					.transition(gt)
					.attr("transform", transform),

				mainArea
					.transition(gt)
					.attr("transform", transform),

				mainCircle
					.transition(gt)
					.attr("transform", transform),

				mainText
					.transition(gt)
					.attr("transform", transform),

				mainRegion
					.filter($$.isRegionOnX)
					.transition(gt)
					.attr("transform", transform),

				xgrid
					.transition(gt)
					.attr("transform", transform),

				xgridLines
					.transition(gt)
					.attr("transform", transform),
			]);

			gt.call(wait, () => {
				const isRotated = config.axis_rotated;

				// remove flowed elements
				if (flowLength) {
					const target = {
						shapes: [],
						texts: [],
						eventRects: []
					};

					for (let i = 0; i < flowLength; i++) {
						target.shapes.push(`.${CLASS.shape}-${i}`);
						target.texts.push(`.${CLASS.text}-${i}`);
						target.eventRects.push(`.${CLASS.eventRect}-${i}`);
					}

					["shapes", "texts", "eventRects"].forEach(v => {
						$el.svg.selectAll(`.${CLASS[v]}`)
							.selectAll(target[v])
							.remove();
					});

					$el.svg.select(`.${CLASS.xgrid}`)
						.remove();
				}

				// draw again for removing flowed elements and reverting attr
				xgrid.size() && xgrid
					.attr("transform", null)
					.attr($$.xgridAttr);

				xgridLines
					.attr("transform", null);

				xgridLines.select("line")
					.attr("x1", isRotated ? 0 : xv)
					.attr("x2", isRotated ? $$.width : xv);

				xgridLines.select("text")
					.attr("x", isRotated ? $$.width : 0)
					.attr("y", xv);

				mainBar
					.attr("transform", null)
					.attr("d", drawBar);

				mainLine
					.attr("transform", null)
					.attr("d", drawLine);

				mainArea
					.attr("transform", null)
					.attr("d", drawArea);

				mainCircle
					.attr("transform", null);

				if ($$.isCirclePoint()) {
					mainCircle
						.attr("cx", cx)
						.attr("cy", cy);
				} else {
					const xFunc = d => cx(d) - config.point_r;
					const yFunc = d => cy(d) - config.point_r;

					mainCircle
						.attr("x", xFunc)
						.attr("y", yFunc)
						.attr("cx", cx) // when pattern is used, it possibly contain 'circle' also.
						.attr("cy", cy);
				}

				mainText
					.attr("transform", null)
					.attr("x", xForText)
					.attr("y", yForText)
					.style("fill-opacity", $$.opacityForText.bind($$));

				mainRegion
					.attr("transform", null);

				mainRegion.select("rect").filter($$.isRegionOnX)
					.attr("x", $$.regionX.bind($$))
					.attr("width", $$.regionWidth.bind($$));

				config.interaction_enabled && $$.redrawEventRect();

				// callback for end of flow
				done();

				state.flowing = false;
			});
		};
	}
};