'use client';
import { FeedFilter, FeedType } from '@/types/Feed';
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { SupabasePost } from '@/types/SupabasePost';
import { useSupabaseProvider } from './SupabaseProvider';
import findValidEmbed from '@/lib/findValidEmbed';
import fetchPosts from '@/lib/supabase/fetchPosts';
import mergeArraysUniqueByPostHash from '@/lib/mergeArraysUniqueByPostHash';
import { useNeynarProvider } from './NeynarProvider';
import { fetchPostsLimit } from '@/lib/consts';

type FeedProviderType = {
  filter: FeedFilter;
  updateFilter: (change: FeedFilter) => void;
  feed: SupabasePost[];
  feedType: string;
  setFeedType: (feedType: string) => void;
  fetchMore: (start: number) => void;
  hasMore: boolean;
};

const FeedContext = createContext<FeedProviderType>({} as any);

const FeedProvider = ({ children }: { children: ReactNode }) => {
  const [filter, setFilter] = useState<FeedFilter>({});
  const [feed, setFeed] = useState<SupabasePost[]>([]);
  const [feedType, setFeedType] = useState<string>(FeedType.Trending);
  const { supabaseClient } = useSupabaseProvider();
  const [hasMore, setHasMore] = useState(true);
  const { user } = useNeynarProvider();
  const fid = user?.fid;

  const updateFilter = (change: FeedFilter) => {
    setFilter((prev) => ({ ...prev, ...change }));
  };

  const fetchMore = useCallback(
    async (start: number) => {
      setHasMore(true);
      const { posts } = await fetchPosts(supabaseClient, filter, feedType, start, fid);
      if (!(posts && posts.length === fetchPostsLimit)) {
        setHasMore(false);
      }
      setFeed((prev) => {
        const mergedUnique = mergeArraysUniqueByPostHash(prev, posts);
        return mergedUnique;
      });
    },
    [feedType, filter, supabaseClient, fid],
  );

  useEffect(() => {
    const init = async () => {
      setFeed([]);
      await fetchMore(0);
    };
    init();
  }, [fetchMore]);

  const filteredFeed = useMemo(
    () =>
      feed.filter((cast) => {
        const channelId = cast.channelId;

        if (filter.channel) {
          if (!(channelId && channelId.includes(filter.channel))) return false;
        }

        const validEmbed = findValidEmbed(cast, { platform: filter.platform });
        if (!validEmbed) return false;

        return true;
      }),
    [feed, filter],
  );

  const value = {
    filter,
    updateFilter,
    feed: filteredFeed,
    feedType,
    setFeedType,
    fetchMore,
    hasMore,
  };

  return <FeedContext.Provider value={value}>{children}</FeedContext.Provider>;
};

export const useFeedProvider = () => {
  const context = useContext(FeedContext);
  if (!context) {
    throw new Error('useFeedProvider must be used within a FeedProvider');
  }
  return context;
};

export default FeedProvider;
