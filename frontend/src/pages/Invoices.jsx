import { useState, useEffect } from 'react';
import { invoiceAPI, productAPI } from '../services/api.js';
import { Button, Input, Card, Badge, Modal, Pagination, Alert } from '../components/UI.jsx';
import { Plus, Eye, Trash2, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

export const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const { register, handleSubmit, reset, formState: { errors }, watch } = useForm({
    defaultValues: {
      items: [{ product: '', quantity: 1, unitPrice: 0 }],
      customer: { name: '', email: '', phone: '' },
      discount: 0,
      tax: 0,
      paymentMethod: 'cash',
    },
  });

  const items = watch('items');

  useEffect(() => {
    fetchInvoices();
    fetchProducts();
  }, [currentPage, search]);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const { data } = await invoiceAPI.getInvoices({
        page: currentPage,
        limit: 10,
        search: search || undefined,
      });

      if (data.success) {
        setInvoices(data.invoices);
        setTotalPages(data.pagination.pages);
      }
    } catch (err) {
      toast.error('Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data } = await productAPI.getProducts({ limit: 100 });
      if (data.success) {
        setProducts(data.products);
      }
    } catch (err) {
      toast.error('Failed to fetch products');
    }
  };

  const onSubmit = async (formData) => {
    try {
      const { data } = await invoiceAPI.createInvoice(formData);
      if (data.success) {
        toast.success('Invoice created successfully');
        setShowModal(false);
        reset();
        fetchInvoices();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create invoice');
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to cancel this invoice?')) {
      try {
        const { data } = await invoiceAPI.deleteInvoice(id);
        if (data.success) {
          toast.success('Invoice cancelled successfully');
          fetchInvoices();
        }
      } catch (err) {
        toast.error('Failed to cancel invoice');
      }
    }
  };

  const calculateTotal = () => {
    let subTotal = 0;
    items.forEach(item => {
      subTotal += (item.quantity || 0) * (item.unitPrice || 0) - (item.discount || 0);
    });
    const discount = parseFloat(watch('discount')) || 0;
    const tax = parseFloat(watch('tax')) || 0;
    return subTotal - discount + tax;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Invoices</h1>
        <Button variant="primary" onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-2" /> Create Invoice
        </Button>
      </div>

      {/* Search */}
      <Card>
        <Input
          type="text"
          placeholder="Search by invoice number or customer..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
        />
      </Card>

      {/* Invoices Table */}
      <Card>
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-dark-700 rounded animate-pulse" />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <p className="text-center py-8 text-dark-400">No invoices found</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-dark-700">
                <tr>
                  <th className="px-4 py-3 text-left">Invoice #</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice._id} className="border-b border-dark-700 hover:bg-dark-700 hover:bg-opacity-50">
                    <td className="px-4 py-3 font-medium">{invoice.invoiceNumber}</td>
                    <td className="px-4 py-3">{invoice.customer.name}</td>
                    <td className="px-4 py-3 text-right font-medium">${invoice.totalAmount.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={invoice.paymentStatus === 'completed' ? 'success' : 'warning'}>
                        {invoice.paymentStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-dark-400">
                      {new Date(invoice.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center space-x-2">
                      <button className="text-primary-400 hover:text-primary-300 transition">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(invoice._id)}
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

      {/* Create Invoice Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Invoice" size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Customer Info */}
          <div className="space-y-4 border-b border-dark-700 pb-4">
            <h3 className="font-semibold">Customer Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input
                type="text"
                placeholder="Customer Name"
                {...register('customer.name', { required: 'Customer name is required' })}
              />
              <Input
                type="email"
                placeholder="Email"
                {...register('customer.email', { required: 'Email is required' })}
              />
            </div>
            <Input
              type="text"
              placeholder="Phone"
              {...register('customer.phone', { required: 'Phone is required' })}
            />
          </div>

          {/* Items */}
          <div className="space-y-4 border-b border-dark-700 pb-4">
            <h3 className="font-semibold">Items</h3>
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-4 gap-2">
                <select
                  {...register(`items.${index}.product`)}
                  className="input text-xs"
                >
                  <option value="">Select Product</option>
                  {products.map(p => (
                    <option key={p._id} value={p._id}>{p.name}</option>
                  ))}
                </select>
                <Input type="number" placeholder="Qty" min="1" {...register(`items.${index}.quantity`)} />
                <Input type="number" placeholder="Price" step="0.01" {...register(`items.${index}.unitPrice`)} />
                <Input type="number" placeholder="Discount" step="0.01" {...register(`items.${index}.discount`)} />
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="space-y-4 border-b border-dark-700 pb-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                type="number"
                placeholder="Discount"
                step="0.01"
                {...register('discount')}
              />
              <Input
                type="number"
                placeholder="Tax"
                step="0.01"
                {...register('tax')}
              />
            </div>
            <div className="text-right">
              <p className="text-lg font-bold">
                Total: ${calculateTotal().toFixed(2)}
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <Button type="submit" variant="primary" fullWidth>
              Create Invoice
            </Button>
            <Button type="button" variant="secondary" fullWidth onClick={() => setShowModal(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Invoices;
