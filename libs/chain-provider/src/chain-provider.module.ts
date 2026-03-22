import { Global, Module } from '@nestjs/common';
import { CHAIN_PROVIDER } from './chain-provider.interface';
import { RpcChainProvider } from './providers/rpc-chain.provider';
import { MockChainProvider } from './providers/mock-chain.provider';

const providerType = process.env.CHAIN_PROVIDER_TYPE || 'rpc';

@Global()
@Module({
  providers: [
    {
      provide: CHAIN_PROVIDER,
      useClass: providerType === 'mock' ? MockChainProvider : RpcChainProvider,
    },
  ],
  exports: [CHAIN_PROVIDER],
})
export class ChainProviderModule {}
