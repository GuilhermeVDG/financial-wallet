import { SetMetadata } from '@nestjs/common';

export const IS_DISABLED_TIMEOUT = 'isDisabledTimeout';
export const DisableTimeout = () => SetMetadata(IS_DISABLED_TIMEOUT, true);
