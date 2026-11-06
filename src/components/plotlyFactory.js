import Plotly from 'plotly.js-basic-dist-min';
import createPlotlyComponent from 'react-plotly.js/factory';

/**
 * Единая фабрика Plot для всех графиков дашборда.
 *
 * Используем plotly.js-basic-dist-min (~1 МБ вместо ~4.5 МБ полного
 * plotly.js): на дашборде рисуются только scatter-линии, полный бандл
 * с geo/mapbox/gl3d не нужен. Это в ~4 раза меньше трафика и парсинга
 * на слабых/мобильных устройствах.
 */
const Plot = createPlotlyComponent(Plotly);

export default Plot;
