import React from "react";
import { motion } from "framer-motion";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/animated-table";

const products = [
  {
    id: "PROD001",
    name: "Wireless Mouse",
    category: "Electronics",
    price: "$29.99",
    stock: 150,
  },
  {
    id: "PROD002",
    name: "Mechanical Keyboard",
    category: "Electronics",
    price: "$89.99",
    stock: 75,
  },
  {
    id: "PROD003",
    name: "Noise-Cancelling Headphones",
    category: "Audio",
    price: "$199.99",
    stock: 45,
  },
  {
    id: "PROD004",
    name: "Ergonomic Chair",
    category: "Furniture",
    price: "$249.99",
    stock: 30,
  },
  {
    id: "PROD005",
    name: "Standing Desk",
    category: "Furniture",
    price: "$399.99",
    stock: 20,
  },
];

export default function TableDemo() {
  const totalStock = products.reduce((sum, product) => sum + product.stock, 0);

  return (
    <div className="w-full px-10">
      <Table>
        <TableCaption>A list of products in inventory.</TableCaption>

        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Stock</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {products.map((product, index) => (
            <motion.tr
              key={product.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="border-b transition-colors hover:bg-muted/50"
            >
              <TableCell className="font-medium">{product.id}</TableCell>
              <TableCell>{product.name}</TableCell>
              <TableCell>{product.category}</TableCell>
              <TableCell className="text-right">{product.price}</TableCell>
              <TableCell className="text-right">{product.stock}</TableCell>
            </motion.tr>
          ))}
        </TableBody>

        <TableFooter>
          <TableRow>
            <TableCell colSpan={4}>Total Stock</TableCell>
            <TableCell className="text-right">{totalStock}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}
