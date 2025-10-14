import {
  type Channel,
  type ChannelCredentials,
  type ChannelOptions,
  type CompatServiceDefinition,
  createChannel,
  type DefaultCallOptions,
  type NormalizedServiceDefinition,
} from "nice-grpc";

export type RemoveTypeUrl<T> = Omit<T, "$type">;

export type ClientOptions<S extends CompatServiceDefinition> = {
  defaultCallOptions?: DefaultCallOptions<NormalizedServiceDefinition<S>>;
};

export type HostOrChannel =
  | {
      host: string;
      credentials?: ChannelCredentials;
      channelOptions?: ChannelOptions;
      channel?: never;
    }
  | {
      host?: never;
      channel: Channel;
    };

export function createChannelFromConfig(config: HostOrChannel): Channel {
  if (config.host !== undefined) {
    return createChannel(
      config.host,
      config.credentials,
      config.channelOptions,
    );
  }

  return config.channel;
}
