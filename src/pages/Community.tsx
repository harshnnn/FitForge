import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Users, Heart, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

const Community = () => {
  const [posts, setPosts] = useState<any[]>([]);
  const [newPost, setNewPost] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      const { data, error } = await supabase
        .from("community_posts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error("Error loading posts:", error);
    }
  };

  const handleCreatePost = async () => {
    if (!newPost.trim()) {
      toast.error("Please write something!");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("community_posts")
        .insert({
          user_id: user.id,
          content: newPost.trim(),
        });

      if (error) throw error;
      
      toast.success("Post created!");
      setNewPost("");
      loadPosts();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (postId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Check if already liked
      const { data: existingLike } = await supabase
        .from("community_likes")
        .select("*")
        .eq("post_id", postId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (existingLike) {
        // Unlike
        await supabase
          .from("community_likes")
          .delete()
          .eq("post_id", postId)
          .eq("user_id", user.id);

        await supabase.rpc("decrement_likes", { post_id: postId });
      } else {
        // Like
        await supabase
          .from("community_likes")
          .insert({ post_id: postId, user_id: user.id });

        await supabase.rpc("increment_likes", { post_id: postId });
      }

      loadPosts();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-gradient-secondary rounded-full shadow-glow-secondary">
              <Users className="w-8 h-8 text-secondary-foreground" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-hero bg-clip-text text-transparent">
            Community
          </h1>
          <p className="text-muted-foreground">
            Share your fitness journey with others
          </p>
        </div>

        <Card className="border-border/50 shadow-glow-primary mb-8">
          <CardHeader>
            <CardTitle>Create a Post</CardTitle>
            <CardDescription>Share your progress, tips, or ask questions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              placeholder="What's on your mind?"
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              className="min-h-[100px] bg-muted resize-none"
            />
            <Button
              onClick={handleCreatePost}
              disabled={loading}
              className="w-full bg-gradient-primary hover:opacity-90 transition-opacity shadow-glow-primary"
            >
              {loading ? "Posting..." : "Share Post"}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {posts.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="py-12 text-center">
                <MessageCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">
                  No posts yet. Be the first to share!
                </p>
              </CardContent>
            </Card>
          ) : (
            posts.map((post) => (
              <Card key={post.id} className="border-border/50 hover:border-primary/30 transition-colors">
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground mb-2">
                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                  </p>
                  <p className="text-foreground mb-4 whitespace-pre-wrap">{post.content}</p>
                  <div className="flex items-center gap-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLike(post.id)}
                      className="text-muted-foreground hover:text-primary"
                    >
                      <Heart className="w-4 h-4 mr-1" />
                      {post.likes_count || 0}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Community;