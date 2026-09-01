/**
 * Local ML classifier for transaction matching.
 * Uses logistic regression trained on match history.
 * 
 * Why local ML?
 * - No API cost for routine matches
 * - Instant inference (no network latency)
 * - Learns from YOUR specific data patterns
 * - Works offline as fallback
 * 
 * Feature vector:
 * - amount_ratio: min/max of the two amounts (0-1)
 * - amount_diff: absolute difference
 * - date_diff: days between transactions
 * - same_amount: 1 if within tolerance
 * - same_date: 1 if identical
 * - fee_range: 1 if in typical fee range (97-100%)
 */

const FEATURE_NAMES = ['amount_ratio', 'date_diff', 'same_amount', 'same_date', 'fee_range']

/**
 * Simple logistic regression implementation.
 * No external dependencies needed.
 */
class LogisticRegression {
  constructor(weights = null, bias = 0) {
    this.weights = weights || FEATURE_NAMES.map(() => 0)
    this.bias = bias
  }

  predict(features) {
    const z = this.weights.reduce((sum, w, i) => sum + w * features[i], this.bias)
    return 1 / (1 + Math.exp(-z)) // Sigmoid
  }

  train(trainingData, learningRate = 0.1, epochs = 100) {
    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalLoss = 0

      for (const { features, label } of trainingData) {
        const prediction = this.predict(features)
        const error = prediction - label

        // Update weights
        for (let i = 0; i < this.weights.length; i++) {
          this.weights[i] -= learningRate * error * features[i]
        }
        this.bias -= learningRate * error

        // Binary cross-entropy loss
        totalLoss += -label * Math.log(prediction + 1e-7) - (1 - label) * Math.log(1 - prediction + 1e-7)
      }

      // Early stopping if loss converges
      if (epoch > 10 && totalLoss / trainingData.length < 0.01) break
    }
  }

  serialize() {
    return { weights: this.weights, bias: this.bias }
  }

  static deserialize(data) {
    return new LogisticRegression(data.weights, data.bias)
  }
}

let _model = null
let _trainingSize = 0

/**
 * Get or initialize the ML model.
 */
export function getModel() {
  if (!_model) {
    _model = new LogisticRegression()
  }
  return _model
}

/**
 * Extract numeric features from a record pair for ML.
 */
function toFeatureVector(features) {
  return FEATURE_NAMES.map(name => {
    const val = features[name]
    if (typeof val === 'number') return val
    if (typeof val === 'string') return val.length > 0 ? 1 : 0
    return 0
  })
}

/**
 * Train the model on historical match data.
 * @param {Array} trainingData - [{ features: Object, label: boolean }]
 */
export function trainModel(trainingData) {
  if (trainingData.length < 5) {
    console.log('ML: Not enough training data (need ≥5 samples)')
    return false
  }

  const model = getModel()
  const formattedData = trainingData.map(d => ({
    features: toFeatureVector(d.features),
    label: d.label ? 1 : 0,
  }))

  model.train(formattedData, 0.1, 200)
  _trainingSize = trainingData.length
  console.log(`ML: Trained on ${trainingData.length} samples`)
  return true
}

/**
 * Predict match probability for a record pair.
 * @param {Object} features - Extracted features from confidence.js
 * @returns {Object} { probability: number, confidence: string }
 */
export function predict(features) {
  const model = getModel()
  const featureVector = toFeatureVector(features)
  const probability = model.predict(featureVector)

  let confidence
  if (probability >= 0.8) confidence = 'high'
  else if (probability >= 0.6) confidence = 'medium'
  else if (probability >= 0.4) confidence = 'low'
  else confidence = 'very-low'

  return { probability, confidence }
}

/**
 * Get model info for debugging/display.
 */
export function getModelInfo() {
  return {
    trained: _trainingSize > 0,
    trainingSize: _trainingSize,
    weights: _model?.weights || [],
    bias: _model?.bias || 0,
  }
}

/**
 * Serialize model for storage.
 */
export function serializeModel() {
  const model = getModel()
  return model.serialize()
}

/**
 * Load model from storage.
 */
export function loadModel(data) {
  _model = LogisticRegression.deserialize(data)
}
