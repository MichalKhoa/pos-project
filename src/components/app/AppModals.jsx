import React from 'react';
import PaymentModal from '../PaymentModal';
import ReceiptModal from '../ReceiptModal';
import RefundModal from '../RefundModal';
import CalendarModal from '../CalendarModal';
import DiscountModal from '../DiscountModal';
import PendingSyncModal from '../PendingSyncModal';
import ShutdownModal from '../ShutdownModal';
import LockScreenModal from '../LockScreenModal';
import ToastUndo from '../ToastUndo';
import CheckoutFlashBanner from '../CheckoutFlashBanner';
import UnknownBarcodeModal from '../UnknownBarcodeModal';
import PriceCheckModal from '../PriceCheckModal';
import CustomItemModal from '../CustomItemModal';
import ParkedCartsDrawer from '../keypad/ParkedCartsDrawer';

export default function AppModals({
  // Custom Item Modal (2-column mode / quick action)
  isCustomItemModalOpen = false,
  setIsCustomItemModalOpen = null,
  onAddToCartFromCustomItem = null,

  // Parked Carts Modal
  isParkedModalOpen = false,
  setIsParkedModalOpen = null,
  parkedCarts = [],
  onParkCart = null,
  onRestoreParkedCart = null,
  onDeleteParkedCart = null,
  onUpdateParkedCartNote = null,

  // Discount Modal
  isDiscountModalOpen,
  setIsDiscountModalOpen,
  cartItems,
  cartDiscountPercent,
  discountModalSelectedItem,
  onApplyCustomDiscount,

  // Payment Modal
  paymentModalMethod,
  setPaymentModalMethod,
  storeConfig,
  onCompleteSale,
  onOpenCashDrawer,

  // Refund Modal
  refundTargetSale,
  setRefundTargetSale,
  onProcessRefund,

  // Calendar Modal
  isCalendarModalOpen,
  setIsCalendarModalOpen,
  salesHistory,
  onNavigateToHistory,

  // Receipt Modal
  currentReceiptData,
  setCurrentReceiptData,

  // Sync Modal
  showSyncModal,
  pendingSyncCount,
  isSyncingQueue,
  onSyncQueueNow,
  onSnoozeSync,

  // Shutdown Modal
  showShutdownModal,
  setShowShutdownModal,

  // Lock Screen Modal
  isAppLocked,
  onUnlockApp,

  // Unknown Barcode Quick-Add Modal
  unknownBarcode,
  onCloseUnknownBarcode,
  categories,
  itemMultiplier,
  onSaveAndAddUnknownBarcode,

  // Toast & Flash Banners
  undoToast,
  onUndoLastAction,
  onDismissUndoToast,
  flashBanner,
  onDismissFlashBanner,

  // Price Check Modal (Kontrola ceny / Cenovka)
  priceCheckItem,
  setPriceCheckItem,
  unknownPriceCheckBarcode,
  setUnknownPriceCheckBarcode,
  onAddToCartFromPriceCheck,
  onCreateProductFromPriceCheck
}) {
  const computedTotal = Math.round((cartItems.reduce((sum, item) => {
    const disc = item.discountPercent || 0;
    return sum + (item.price * (1 - disc / 100) * item.quantity);
  }, 0) * (1 - cartDiscountPercent / 100) + Number.EPSILON) * 100) / 100;

  return (
    <>
      {/* Price Check Modal (Kontrola ceny / Cenovka) */}
      {(priceCheckItem || unknownPriceCheckBarcode) && (
        <PriceCheckModal
          item={priceCheckItem}
          unknownBarcode={unknownPriceCheckBarcode}
          categories={categories}
          onAddToCart={onAddToCartFromPriceCheck}
          onCreateProduct={onCreateProductFromPriceCheck}
          onClose={() => {
            if (setPriceCheckItem) setPriceCheckItem(null);
            if (setUnknownPriceCheckBarcode) setUnknownPriceCheckBarcode(null);
          }}
        />
      )}

      {/* Custom Discount Modal */}
      <DiscountModal
        isOpen={isDiscountModalOpen}
        onClose={() => setIsDiscountModalOpen(false)}
        totalAmount={cartItems.reduce((sum, item) => {
          const disc = item.discountPercent || 0;
          return sum + (item.price * (1 - disc / 100) * item.quantity);
        }, 0)}
        cartItems={cartItems}
        selectedItem={discountModalSelectedItem}
        onApplyDiscount={onApplyCustomDiscount}
      />

      {/* Payment Modal */}
      {paymentModalMethod && (
        <PaymentModal
          method={paymentModalMethod}
          storeConfig={storeConfig}
          totalAmount={computedTotal}
          onClose={() => setPaymentModalMethod(null)}
          onCompleteSale={onCompleteSale}
          onOpenCashDrawer={onOpenCashDrawer}
        />
      )}

      {/* Refund / Storno Modal */}
      {refundTargetSale && (
        <RefundModal
          sale={refundTargetSale}
          onClose={() => setRefundTargetSale(null)}
          onConfirmRefund={onProcessRefund}
        />
      )}

      {/* Calendar & Shift Overview Modal */}
      {isCalendarModalOpen && (
        <CalendarModal
          salesHistory={salesHistory}
          onClose={() => setIsCalendarModalOpen(false)}
          onNavigateToHistory={onNavigateToHistory}
        />
      )}

      {/* Printable Receipt Modal */}
      {currentReceiptData && (
        <ReceiptModal
          saleData={currentReceiptData}
          storeConfig={storeConfig}
          onClose={() => setCurrentReceiptData(null)}
          onNewSale={() => setCurrentReceiptData(null)}
        />
      )}

      {/* Pending Offline Sales Sync Modal */}
      {showSyncModal && pendingSyncCount > 0 && (
        <PendingSyncModal
          pendingCount={pendingSyncCount}
          isLoading={isSyncingQueue}
          onSync={onSyncQueueNow}
          onSnooze={onSnoozeSync}
        />
      )}

      {/* End-of-Shift Shutdown Modal */}
      {showShutdownModal && (
        <ShutdownModal
          pendingCount={pendingSyncCount}
          onClose={() => setShowShutdownModal(false)}
        />
      )}

      {/* Unknown Barcode Quick-Add Modal */}
      {unknownBarcode && (
        <UnknownBarcodeModal
          scannedBarcode={unknownBarcode}
          categories={categories}
          defaultVat={storeConfig?.defaultVat}
          itemMultiplier={itemMultiplier}
          onSaveAndAdd={onSaveAndAddUnknownBarcode}
          onClose={onCloseUnknownBarcode}
        />
      )}

      {/* Cashier Lock Screen Modal Overlay */}
      {isAppLocked && (
        <LockScreenModal
          storeConfig={storeConfig}
          onUnlock={onUnlockApp}
        />
      )}

      {/* Toast Undo Notification Overlay */}
      <ToastUndo
        undoToast={undoToast}
        onUndo={onUndoLastAction}
        onDismiss={onDismissUndoToast}
      />

      {/* Visual Scan & Checkout Flash Banner */}
      <CheckoutFlashBanner
        flashBanner={flashBanner}
        onDismiss={onDismissFlashBanner}
      />

      {/* Custom Item Modal (2-column layout or toolbar trigger) */}
      {isCustomItemModalOpen && (
        <CustomItemModal
          isOpen={isCustomItemModalOpen}
          onClose={() => {
            if (setIsCustomItemModalOpen) setIsCustomItemModalOpen(false);
          }}
          onAddToCart={(item) => {
            if (onAddToCartFromCustomItem) onAddToCartFromCustomItem(item);
            if (setIsCustomItemModalOpen) setIsCustomItemModalOpen(false);
          }}
          defaultVat={storeConfig?.defaultVat}
          initialMultiplier={itemMultiplier}
        />
      )}

      {/* Standalone Parked Carts Modal Dialog */}
      {isParkedModalOpen && (
        <ParkedCartsDrawer
          modalOnly={true}
          isOpen={isParkedModalOpen}
          onOpenChange={setIsParkedModalOpen}
          parkedCarts={parkedCarts}
          onParkCart={onParkCart}
          onRestoreParkedCart={onRestoreParkedCart}
          onDeleteParkedCart={onDeleteParkedCart}
          onUpdateParkedCartNote={onUpdateParkedCartNote}
        />
      )}
    </>
  );
}
