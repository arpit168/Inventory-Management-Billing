import { useState, useEffect } from 'react';
import { productAPI, categoryAPI } from '../services/api.js';
import { Button, Input, Select, Card, Badge, Modal, Pagination, Alert } from '../components/UI.jsx';
import { Plus, Edit, Trash2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

export const Products = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const { register, handleSubmit, reset, formState: { errors } } = useForm();
  const [lowStock, setLowStock] = useState(0);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [currentPage, search, categoryFilter]);

  useEffect(() => {
    fetchLowStockCount();
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data } = await productAPI.getProducts({
        page: currentPage,
        limit: 10,
        search: search || undefined,
        category: categoryFilter || undefined,
      });

      if (data.success) {
        setProducts(data.products);
        setTotalPages(data.pagination.pages);
      }
    } catch (err) {
      toast.error('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data } = await categoryAPI.getCategories({ limit: 100 });
      if (data.success) {
        setCategories(data.categories);
      }
    } catch (err) {
      toast.error('Failed to fetch categories');
    }
  };

  const fetchLowStockCount = async () => {
    try {
      const { data } = await productAPI.getLowStockProducts({ limit: 1 });
      if (data.success) {
        setLowStock(data.products.length);
      }
    } catch (err) {
      console.error('Failed to fetch low stock count');
    }
  };

  const onSubmit = async (formData) => {
    try {
      if (editingProduct) {
        const { data } = await productAPI.updateProduct(editingProduct._id, formData);
        if (data.success) {
          toast.success('Product updated successfully');
        }
      } else {
        const { data } = await productAPI.addProduct(formData);
        if (data.success) {
          toast.success('Product added successfully');
        }
      }
      setShowModal(false);
      reset();
      setEditingProduct(null);
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        const { data } = await productAPI.deleteProduct(id);
        if (data.success) {
          toast.success('Product deleted successfully');
          fetchProducts();
        }
      } catch (err) {
        toast.error('Failed to delete product');
      }
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    reset(product);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    reset();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Products</h1>
        <Button variant="primary" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Product
        </Button>
      </div>

      {lowStock > 0 && (
        <Alert variant="warning" title="Low Stock Alert">
          You have {lowStock} products with low stock levels.
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-dark-400" />
            <Input
              type="text"
              placeholder="Search by name or SKU..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10"
            />
          </div>
          <Select
            options={categories.map(cat => ({ value: cat._id, label: cat.name }))}
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </Card>

      {/* Products Table */}
      <Card>
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-dark-700 rounded animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <p className="text-center py-8 text-dark-400">No products found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-dark-700">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">SKU</th>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-right">Quantity</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product._id} className="border-b border-dark-700 hover:bg-dark-700 hover:bg-opacity-50">
                    <td className="px-4 py-3">{product.name}</td>
                    <td className="px-4 py-3">{product.sku}</td>
                    <td className="px-4 py-3">{product.category?.name || 'N/A'}</td>
                    <td className="px-4 py-3 text-right">
                      <Badge variant={product.quantity === 0 ? 'error' : product.quantity <= product.minimumStock ? 'warning' : 'success'}>
                        {product.quantity}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">${product.sellingPrice.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={product.status === 'active' ? 'success' : 'info'}>
                        {product.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-center space-x-2">
                      <button
                        onClick={() => handleEdit(product)}
                        className="text-primary-400 hover:text-primary-300 transition"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(product._id)}
                        className="text-error hover:text-red-400 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {totalPages > 1 && (
        <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      )}

      {/* Add/Edit Product Modal */}
      <Modal isOpen={showModal} onClose={handleCloseModal} title={editingProduct ? 'Edit Product' : 'Add Product'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Product Name</label>
            <Input
              type="text"
              error={!!errors.name}
              helperText={errors.name?.message}
              {...register('name', { required: 'Product name is required' })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">SKU</label>
            <Input
              type="text"
              error={!!errors.sku}
              helperText={errors.sku?.message}
              {...register('sku', { required: 'SKU is required' })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Category</label>
            <Select
              options={categories.map(cat => ({ value: cat._id, label: cat.name }))}
              error={!!errors.category}
              helperText={errors.category?.message}
              {...register('category', { required: 'Category is required' })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Purchase Price</label>
              <Input
                type="number"
                step="0.01"
                error={!!errors.purchasePrice}
                helperText={errors.purchasePrice?.message}
                {...register('purchasePrice', { required: 'Purchase price is required' })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Selling Price</label>
              <Input
                type="number"
                step="0.01"
                error={!!errors.sellingPrice}
                helperText={errors.sellingPrice?.message}
                {...register('sellingPrice', { required: 'Selling price is required' })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Quantity</label>
              <Input
                type="number"
                min="0"
                error={!!errors.quantity}
                helperText={errors.quantity?.message}
                {...register('quantity', { required: 'Quantity is required' })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Minimum Stock</label>
              <Input
                type="number"
                min="0"
                error={!!errors.minimumStock}
                helperText={errors.minimumStock?.message}
                {...register('minimumStock')}
              />
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="submit" variant="primary" fullWidth>
              {editingProduct ? 'Update Product' : 'Add Product'}
            </Button>
            <Button type="button" variant="secondary" fullWidth onClick={handleCloseModal}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Products;
