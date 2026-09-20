const React = require('react');
const { View } = require('react-native');

function createStub(name) {
  const Cmp = React.forwardRef((props, ref) =>
    React.createElement(View, { ...props, ref, testID: props.testID ?? `mapbox-${name}` }, props.children),
  );
  Cmp.displayName = name;
  return Cmp;
}

const Mapbox = {
  setAccessToken: jest.fn(),
  StyleURL: { Street: 'mapbox://styles/mapbox/streets-v12' },
  MapView: createStub('MapView'),
  Camera: createStub('Camera'),
  ShapeSource: createStub('ShapeSource'),
  HeatmapLayer: createStub('HeatmapLayer'),
  LineLayer: createStub('LineLayer'),
  CircleLayer: createStub('CircleLayer'),
  PointAnnotation: createStub('PointAnnotation'),
};

module.exports = {
  __esModule: true,
  default: Mapbox,
  ...Mapbox,
};
