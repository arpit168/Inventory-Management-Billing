// Invoices.jsx

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

import { invoiceAPI, productAPI } from '../services/api.js';

import {
  Button,
  Input,
  Card,
  Badge,
  Modal,
  Pagination,
} from '../components/UI.jsx';

import {
  Plus,
  Eye,
  Trash2,
  Search,
  Receipt,
  DollarSign,
  TrendingUp,
  FileText,
} from 'lucide-react';

const Invoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
  } = useForm({
    defaultValues: {
      customer: {
        name: '',
        email: '',
        phone: '',
      },
      items: [
        {
          product: '',
          quantity: 1,
          unitPrice: 0,
          discount: 0,
        },
      ],
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
    } catch {
      toast.error('Failed to fetch invoices');
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data } = await productAPI.getProducts({
        limit: 100,
      });

      if (data.success) {
        setProducts(data.products);
      }
    } catch {
      toast.error('Failed to fetch products');
    }
  };

  const onSubmit = async (formData) => {
    try {
      const { data } = await invoiceAPI.createInvoice(formData);

      if (data.success) {
        toast.success('Invoice created');
        setShowModal(false);
        reset();
        fetchInvoices();
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.message ||
        'Failed to create invoice'
      );
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Cancel this invoice?')) return;

    try {
      const { data } = await invoiceAPI.deleteInvoice(id);

      if (data.success) {
        toast.success('Invoice cancelled');
        fetchInvoices();
      }
    } catch {
      toast.error('Failed to cancel invoice');
    }
  };

  const calculateTotal = () => {
    let subtotal = 0;

    items.forEach((item) => {
      subtotal +=
        (Number(item.quantity) || 0) *
          (Number(item.unitPrice) || 0) -
        (Number(item.discount) || 0);
    });

    const discount =
      Number(watch('discount')) || 0;

    const tax =
      Number(watch('tax')) || 0;

    return subtotal - discount + tax;
  };

  const totalRevenue = invoices.reduce(
    (sum, inv) => sum + inv.totalAmount,
    0
  );

  const paidInvoices = invoices.filter(
    (i) => i.paymentStatus === 'completed'
  ).length;

  const pendingInvoices =
    invoices.length - paidInvoices;

  return (
    <div className="space-y-6">

      {/* HEADER */}

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold">
            Invoice Management
          </h1>

          <p className="text-base-content/60">
            Create, manage and track invoices
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setShowModal(true)}
          className="gap-2"
        >
          <Plus size={18} />
          Create Invoice
        </Button>
      </div>

      {/* STATS */}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

        <Card className="p-5">
          <div className="flex justify-between">
            <div>
              <p className="text-sm opacity-70">
                Total Invoices
              </p>
              <h2 className="text-3xl font-bold">
                {invoices.length}
              </h2>
            </div>

            <Receipt className="w-10 h-10 text-primary" />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex justify-between">
            <div>
              <p className="text-sm opacity-70">
                Revenue
              </p>

              <h2 className="text-3xl font-bold">
                ${totalRevenue.toFixed(2)}
              </h2>
            </div>

            <DollarSign className="w-10 h-10 text-primary" />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex justify-between">
            <div>
              <p className="text-sm opacity-70">
                Paid
              </p>

              <h2 className="text-3xl font-bold">
                {paidInvoices}
              </h2>
            </div>

            <TrendingUp className="w-10 h-10 text-success" />
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex justify-between">
            <div>
              <p className="text-sm opacity-70">
                Pending
              </p>

              <h2 className="text-3xl font-bold">
                {pendingInvoices}
              </h2>
            </div>

            <FileText className="w-10 h-10 text-warning" />
          </div>
        </Card>
      </div>

      {/* SEARCH */}

      <Card className="p-4">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 opacity-50"
            size={18}
          />

          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search invoice number or customer..."
            className="pl-10"
          />
        </div>
      </Card>

      {/* TABLE */}

      <Card className="overflow-hidden">

        {loading ? (
          <div className="p-6 space-y-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="h-14 rounded bg-base-300 animate-pulse"
              />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-20 text-center">
            <Receipt className="mx-auto w-16 h-16 opacity-20 mb-4" />

            <h3 className="text-xl font-semibold">
              No Invoices Found
            </h3>

            <p className="opacity-60">
              Create your first invoice.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">

            <table className="w-full">

              <thead className="bg-primary text-primary-content">

                <tr>
                  <th className="p-4 text-left">
                    Invoice
                  </th>

                  <th className="p-4 text-left">
                    Customer
                  </th>

                  <th className="p-4 text-right">
                    Amount
                  </th>

                  <th className="p-4">
                    Status
                  </th>

                  <th className="p-4">
                    Date
                  </th>

                  <th className="p-4">
                    Actions
                  </th>
                </tr>

              </thead>

              <tbody>

                {invoices.map((invoice) => (
                  <tr
                    key={invoice._id}
                    className="border-b hover:bg-base-200 transition"
                  >
                    <td className="p-4 font-medium">
                      {invoice.invoiceNumber}
                    </td>

                    <td className="p-4">
                      {invoice.customer?.name}
                    </td>

                    <td className="p-4 text-right font-bold text-success">
                      ${invoice.totalAmount.toFixed(2)}
                    </td>

                    <td className="p-4 text-center">
                      <Badge
                        variant={
                          invoice.paymentStatus ===
                          'completed'
                            ? 'success'
                            : 'warning'
                        }
                      >
                        {invoice.paymentStatus}
                      </Badge>
                    </td>

                    <td className="p-4 text-center">
                      {new Date(
                        invoice.createdAt
                      ).toLocaleDateString()}
                    </td>

                    <td className="p-4">
                      <div className="flex justify-center gap-2">

                        <button
                          onClick={() =>
                            setSelectedInvoice(invoice)
                          }
                          className="btn btn-sm btn-primary btn-outline"
                        >
                          <Eye size={16} />
                        </button>

                        <button
                          onClick={() =>
                            handleDelete(invoice._id)
                          }
                          className="btn btn-sm btn-error btn-outline"
                        >
                          <Trash2 size={16} />
                        </button>

                      </div>
                    </td>
                  </tr>
                ))}

              </tbody>

            </table>

          </div>
        )}
      </Card>

      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      )}

      {/* CREATE MODAL */}
      {/* Keep your existing modal form here */}

      {/* PREVIEW MODAL */}

      <Modal
        isOpen={!!selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
        title="Invoice Details"
        size="lg"
      >
        {selectedInvoice && (
          <div className="space-y-4">

            <Card className="p-4">
              <p>
                <strong>Invoice:</strong>{' '}
                {selectedInvoice.invoiceNumber}
              </p>

              <p>
                <strong>Customer:</strong>{' '}
                {selectedInvoice.customer?.name}
              </p>

              <p>
                <strong>Email:</strong>{' '}
                {selectedInvoice.customer?.email}
              </p>

              <p>
                <strong>Total:</strong>{' '}
                ${selectedInvoice.totalAmount}
              </p>
            </Card>

          </div>
        )}
      </Modal>

    </div>
  );
};

export default Invoices;