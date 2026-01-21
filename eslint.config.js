import antfu from '@antfu/eslint-config'
import ifOnelineRule from './scripts/if-oneline.js'

export default antfu({
  rules: {
    'ts/no-namespace': 'off',
    'ts/method-signature-style': ['error', 'method'],
    'naily/if-oneline': 'error',
    'antfu/if-newline': 'off',
    'no-console': ['error', { allow: ['log', 'error', 'dir'] }],
  },
  plugins: {
    naily: {
      rules: {
        'if-oneline': ifOnelineRule,
      },
    },
  },
})
