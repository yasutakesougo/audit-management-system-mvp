declare module '@mui/utils/chainPropTypes' {
  import type { Validator } from 'prop-types';

  export default function chainPropTypes<A, B>(
    propType1: Validator<A>,
    propType2: Validator<B>
  ): Validator<A & B>;
}

declare module '@mui/utils/chainPropTypes/chainPropTypes' {
  import type { Validator } from 'prop-types';

  export default function chainPropTypes<A, B>(
    propType1: Validator<A>,
    propType2: Validator<B>
  ): Validator<A & B>;
}
