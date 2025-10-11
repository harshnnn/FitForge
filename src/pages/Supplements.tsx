import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Package } from "lucide-react";
import { toast } from "sonner";

const Supplements = () => {
  const [supplements, setSupplements] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    loadSupplements();
  }, []);

  const loadSupplements = async () => {
    try {
      const { data, error } = await supabase
        .from("supplements")
        .select("*")
        .eq("in_stock", true)
        .order("name");

      if (error) throw error;
      setSupplements(data || []);
    } catch (error) {
      console.error("Error loading supplements:", error);
    }
  };

  const categories = [...new Set(supplements.map((s) => s.category).filter(Boolean))];

  const filteredSupplements = selectedCategory
    ? supplements.filter((s) => s.category === selectedCategory)
    : supplements;

  const handleAddToCart = (supplement: any) => {
    toast.success(`${supplement.name} added to cart!`);
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-gradient-accent rounded-full shadow-glow-accent">
              <ShoppingBag className="w-8 h-8 text-accent-foreground" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-hero bg-clip-text text-transparent">
            Supplement Store
          </h1>
          <p className="text-muted-foreground">
            Premium supplements to fuel your fitness journey
          </p>
        </div>

        {categories.length > 0 && (
          <Card className="border-border/50 mb-8">
            <CardHeader>
              <CardTitle>Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={!selectedCategory ? "default" : "outline"}
                  className={!selectedCategory ? "bg-gradient-primary shadow-glow-primary" : ""}
                  onClick={() => setSelectedCategory(null)}
                >
                  All Products
                </Button>
                {categories.map((category) => (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? "default" : "outline"}
                    className={selectedCategory === category ? "bg-gradient-primary shadow-glow-primary" : ""}
                    onClick={() => setSelectedCategory(category)}
                  >
                    {category}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSupplements.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground text-lg">
                No supplements available yet.
              </p>
            </div>
          ) : (
            filteredSupplements.map((supplement) => (
              <Card key={supplement.id} className="border-border/50 hover:border-accent/50 transition-all hover:shadow-glow-accent">
                <CardHeader>
                  {supplement.image_url && (
                    <div className="w-full h-48 bg-muted rounded-lg mb-4 overflow-hidden">
                      <img
                        src={supplement.image_url}
                        alt={supplement.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <CardTitle className="text-xl">{supplement.name}</CardTitle>
                  <CardDescription>{supplement.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-2xl font-bold text-primary">
                      ${supplement.price}
                    </span>
                    {supplement.category && (
                      <Badge className="bg-gradient-secondary">{supplement.category}</Badge>
                    )}
                  </div>
                  <Button
                    onClick={() => handleAddToCart(supplement)}
                    className="w-full bg-gradient-accent hover:opacity-90 transition-opacity shadow-glow-accent"
                  >
                    Add to Cart
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Supplements;